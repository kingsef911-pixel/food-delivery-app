// lib/timeoutChecker.ts
import { connectToDatabase } from '@/lib/db';
import { Order, User } from '@/lib/models';
import { dispatchOrderToNextRider } from '@/lib/dispatch';

/**
 * Checks for expired order offers (older than 45s) and handles auto-decline / re-dispatch atomically.
 */
export async function checkExpiredOffers() {
  try {
    await connectToDatabase();
    const now = new Date();

    // 1. Find all eligible expired orders
    const expiredOrders = await Order.find({
      status: 'OFFERED',
      offerExpiresAt: { $lte: now },
    });

    if (expiredOrders.length === 0) return { checked: 0, expired: 0 };

    let processedCount = 0;

    for (const rawOrder of expiredOrders) {
      // ATOMIC CLAIM: Ensure only one process can transition this specific expired order 
      // from 'OFFERED' to 'PENDING_ASSIGNMENT' due to timeout.
      const order = await Order.findOneAndUpdate(
        { _id: rawOrder._id, status: 'OFFERED', offerExpiresAt: { $lte: now } },
        { $set: { status: 'PENDING_ASSIGNMENT', currentRiderId: null, offerExpiresAt: null } },
        { new: true }
      );

      // If another cron thread already grabbed and processed this order, skip it safely.
      if (!order) continue;

      const riderId = rawOrder.currentRiderId;

      if (riderId) {
        const rider = await User.findById(riderId);

        if (rider) {
          // Record TIMEOUT in order history
          order.assignmentHistory.push({
            riderId: rider._id,
            action: 'TIMEOUT',
            timestamp: new Date(),
          });
          await order.save();

          // Update rider status to AVAILABLE, increment decline/timeout count, move to bottom of queue
          rider.status = 'AVAILABLE';
          rider.declineCount += 1;
          const highestQueueRider = await User.findOne({ role: 'RIDER', status: 'AVAILABLE' }).sort({ queuePosition: -1 });
          rider.queuePosition = highestQueueRider ? highestQueueRider.queuePosition + 1 : 1;
          await rider.save();

          console.log(`[TIMEOUT] Rider ${rider.name} timed out on Order #${order.orderNumber}. Moved to back of queue (Pos #${rider.queuePosition}).`);
        }
      }

      // Re-dispatch order to next available rider
      await dispatchOrderToNextRider(order._id.toString());
      processedCount++;
    }

    return { checked: expiredOrders.length, expired: processedCount };

  } catch (error: any) {
    console.error('Error checking expired offers:', error);
    return { error: error.message };
  }
}