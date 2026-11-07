// app/api/cron/check-timeouts/route.ts (or your timeout endpoint path)
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { Order, User } from '@/lib/models';
import { dispatchOrderToNextRider } from '@/lib/dispatch';
import { logEvent } from '@/lib/utils/logger';

async function ensureDB() {
  if (mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => {
      mongoose.connection.once('connected', resolve);
    });
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI || '', { bufferCommands: true });
}

export async function GET() {
  try {
    await ensureDB();
    const now = new Date();

    const expiredOrders = await Order.find({
      status: 'OFFERED',
      offerExpiresAt: { $lt: now },
    });

    let reDispatchedCount = 0;

    for (const order of expiredOrders) {
      const riderId = order.currentRiderId;

      if (riderId) {
        order.assignmentHistory.push({
          riderId: riderId,
          action: 'TIMEOUT',
          timestamp: new Date(),
        });

        // Find highest queue position for rotation
        const highestQueueRider = await User.findOne({ role: 'RIDER', status: 'AVAILABLE' }).sort({ queuePosition: -1 });
        const nextQueuePos = highestQueueRider ? highestQueueRider.queuePosition + 1 : 1;

        // Release rider, increment decline/timeout, and push to back of queue
        await User.findByIdAndUpdate(riderId, {
          status: 'AVAILABLE',
          $inc: { declineCount: 1 },
          queuePosition: nextQueuePos,
        });

        // Log timeout event
        await logEvent({
          userId: riderId.toString(),
          userRole: 'RIDER',
          action: 'ORDER_TIMEOUT',
          targetId: order._id.toString(),
          details: { orderNumber: order.orderNumber },
        });
      }

      order.status = 'PENDING_ASSIGNMENT';
      order.currentRiderId = undefined;
      order.offerExpiresAt = undefined;
      await order.save();

      // **THE MISSING PIECE:** Forward the order to the next available rider!
      const dispatchResult = await dispatchOrderToNextRider(order._id.toString());
      if (dispatchResult.success) {
        reDispatchedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      expiredProcessed: expiredOrders.length,
      reDispatched: reDispatchedCount 
    });
  } catch (error: any) {
    console.error('SERVER CRON ERROR (timeouts):', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}