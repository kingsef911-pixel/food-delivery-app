// lib/dispatch.ts
import { User, Order } from '@/lib/models';
import { sendSemaphoreSms } from '@/lib/utils/sms';

/**
 * Automatically assigns a pending order to the next available rider in the FIFO queue.
 */
export async function dispatchOrderToNextRider(orderId: string) {
  try {
    const order = await Order.findById(orderId);
    if (!order || !['PENDING_ASSIGNMENT', 'OFFERED', 'UNASSIGNED_ALERT'].includes(order.status)) {
      return { success: false, message: 'Order is no longer eligible for dispatch.' };
    }

    // 1. Find the next available rider in the FIFO queue
    // Sorted by queuePosition ascending (lowest position = available the longest)
    const nextRider = await User.findOne({
      role: 'RIDER',
      status: 'AVAILABLE',
    }).sort({ queuePosition: 1, updatedAt: 1 });

    // FALLBACK 1: No riders currently available
    if (!nextRider) {
      order.status = 'UNASSIGNED_ALERT';
      order.currentRiderId = undefined;
      order.offerExpiresAt = undefined;
      await order.save();

      console.warn(`[FALLBACK TRIGGERED] Order #${order.orderNumber} placed in UNASSIGNED_ALERT state. No available riders online.`);

      // Optional Admin SMS Fallback Alert
      const adminPhone = process.env.ADMIN_ALERT_PHONE;
      if (adminPhone) {
        await sendSemaphoreSms({
          phone: adminPhone,
          message: `[ALERT] Order #${order.orderNumber} needs manual assignment! No available riders online.`,
        });
      }

      return { 
        success: false, 
        fallback: true,
        message: 'No available riders currently online. Order moved to UNASSIGNED_ALERT state.' 
      };
    }

    // 2. Set order state to OFFERED for this specific rider (45-second timeout window)
    const expiresAt = new Date(Date.now() + 45 * 1000);
    order.status = 'OFFERED';
    order.currentRiderId = nextRider._id;
    order.offerExpiresAt = expiresAt;
    order.assignmentHistory.push({
      riderId: nextRider._id,
      action: 'OFFERED',
      timestamp: new Date(),
    });
    await order.save();
    
    // Mark rider as BUSY so they are not assigned multiple orders simultaneously
    nextRider.status = 'BUSY';
    await nextRider.save();

    // 3. Send SMS dispatch notification with secure action link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const dispatchLink = `${appUrl}/rider/dispatch?orderId=${order._id}&riderId=${nextRider._id}`;
    
    const smsMessage = `[DELIVERY ALERT] New order #${order.orderNumber}! Pickup: ${order.pickupAddress}. Tap to accept within 45s: ${dispatchLink}`;
    
    // FALLBACK 2: SMS dispatch failsafe wrapper
    try {
      await sendSemaphoreSms({
        phone: nextRider.phone,
        message: smsMessage,
      });
    } catch (smsError) {
      console.error(`[SMS FALLBACK] Failed to dispatch SMS to rider ${nextRider.name} (${nextRider.phone}):`, smsError);
      console.log(`[SIMULATED SMS LINK]: ${dispatchLink}`);
    }

    return { 
      success: true, 
      message: `Order offered to rider ${nextRider.name}`, 
      riderId: nextRider._id 
    };

  } catch (error: any) {
    console.error('Dispatch Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handles Rider Decline: Increments decline count, moves to bottom of queue, re-dispatches.
 */
export async function handleRiderDecline(orderId: string, riderId: string) {
  const order = await Order.findById(orderId);
  const rider = await User.findById(riderId);

  if (!order || !rider) return { success: false, error: 'Invalid order or rider.' };

  // 1. Record decline in order history
  order.assignmentHistory.push({
    riderId: rider._id,
    action: 'DECLINED',
    timestamp: new Date(),
  });

  // 2. Increment rider decline count, set status to AVAILABLE, and move to bottom of queue
  rider.status = 'AVAILABLE';
  rider.declineCount += 1;
  const highestQueueRider = await User.findOne({ role: 'RIDER', status: 'AVAILABLE' }).sort({ queuePosition: -1 });
  rider.queuePosition = highestQueueRider ? highestQueueRider.queuePosition + 1 : 1;
  await rider.save();

  // 3. Forward order to the next available rider
  return await dispatchOrderToNextRider(order._id.toString());
}