// lib/jobs/checkStaleOrders.ts
import { connectToDatabase } from '@/lib/db';
import { Order, User } from '@/lib/models';

export async function checkStaleOrders() {
  try {
    await connectToDatabase();

    const now = new Date();

    // 1. Find orders stuck in OFFERED where the offer has expired
    const expiredOffers = await Order.find({
      status: 'OFFERED',
      offerExpiresAt: { $lt: now },
    });

    for (const order of expiredOffers) {
      // Handle timeout logic, increment rider decline/timeout count, and re-dispatch or mark unassigned
      console.log(`Order ${order.orderNumber} offer expired.`);
      
      if (order.currentRiderId) {
        // Increment rider timeout / decline metrics or update queue position
        await User.findByIdAndUpdate(order.currentRiderId, {
          $inc: { declineCount: 1 },
          status: 'AVAILABLE',
        });

        order.assignmentHistory.push({
          riderId: order.currentRiderId,
          action: 'TIMEOUT',
          timestamp: now,
        });
      }

      order.status = 'PENDING_ASSIGNMENT';
      order.currentRiderId = undefined;
      order.offerExpiresAt = undefined;
      await order.save();
    }

    return { success: true, processedExpired: expiredOffers.length };
  } catch (error: any) {
    console.error('Check Stale Orders Job Error:', error);
    return { success: false, error: error.message };
  }
}