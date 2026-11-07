// app/api/rider/update-status/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Order, User } from '@/lib/models';
import { sendSemaphoreSms } from '@/lib/utils/sms';
import { dispatchOrderToNextRider } from '@/lib/dispatch';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const orderId = body.orderId;
    const riderId = body.riderId;
    const newStatus = body.newStatus || body.status; // <-- Supports both 'newStatus' and 'status'

    const order = await Order.findById(orderId);
    const rider = await User.findById(riderId);

    if (!order || !rider) {
      return NextResponse.json({ success: false, error: 'Order or rider not found.' }, { status: 404 });
    }

    const now = new Date();
    order.status = newStatus;

    // Record milestone timestamps
    if (newStatus === 'ACCEPTED') order.acceptedAt = now;
    if (newStatus === 'ARRIVED_STORE') order.arrivedStoreAt = now;
    if (newStatus === 'PICKED_UP') order.pickedUpAt = now;
    if (newStatus === 'ARRIVED_DROPOFF') order.arrivedDropoffAt = now;
    
    if (newStatus === 'DELIVERED') {
      order.completedAt = now;
      const startTime = order.acceptedAt || order.createdAt;
      const diffMs = now.getTime() - new Date(startTime).getTime();
      order.totalDeliveryTimeMinutes = Math.round(diffMs / 60000);
    }

    order.assignmentHistory.push({
      riderId: rider._id,
      action: newStatus,
      timestamp: now,
    });
    await order.save();

    let customerMessage = '';
    const trackingLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/track/${order._id}`;

    switch (newStatus) {
      case 'ACCEPTED':
        customerMessage = `[FoodDelivery] Order #${order.orderNumber} accepted by rider ${rider.name} (${rider.phone}). Track: ${trackingLink}`;
        break;
      case 'ARRIVED_STORE':
        customerMessage = `[FoodDelivery] Your rider ${rider.name} has arrived at the store for order #${order.orderNumber}.`;
        break;
      case 'PICKED_UP':
        customerMessage = `[FoodDelivery] Order #${order.orderNumber} picked up and en-route to your drop-off!`;
        break;
      case 'ARRIVED_DROPOFF':
        customerMessage = `[FoodDelivery] Your rider ${rider.name} has arrived at your drop-off address for order #${order.orderNumber}!`;
        break;
      case 'DELIVERED':
        customerMessage = `[FoodDelivery] Order #${order.orderNumber} successfully delivered in ${order.totalDeliveryTimeMinutes} mins. Enjoy your meal!`;
        
        const highestQueueRider = await User.findOne({ role: 'RIDER', status: 'AVAILABLE' }).sort({ queuePosition: -1 });
        rider.status = 'AVAILABLE';
        rider.queuePosition = highestQueueRider ? highestQueueRider.queuePosition + 1 : 1;
        await rider.save();

        // Automatically dispatch any pending/unassigned orders from the backlog
        const pendingOrder = await Order.findOne({ 
          status: { $in: ['UNASSIGNED_ALERT', 'PENDING_ASSIGNMENT'] } 
        }).sort({ createdAt: 1 });

        if (pendingOrder) {
          console.log(`[AUTO-DISPATCH] Rider ${rider.name} freed up. Dispatching backlog order #${pendingOrder.orderNumber}`);
          await dispatchOrderToNextRider(pendingOrder._id.toString());
        }
        break;
    }

    if (order.customerPhone && customerMessage) {
      try {
        await sendSemaphoreSms({
          phone: order.customerPhone,
          message: customerMessage,
        });
      } catch (smsErr) {
        console.error('Failed to send SMS:', smsErr);
      }
    }

    return NextResponse.json({ success: true, message: `Status updated to ${newStatus}` });
  } catch (error: any) {
    console.error('Status update error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}