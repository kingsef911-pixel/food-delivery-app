import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { Order, User } from '@/lib/models';

async function ensureDB() {
  if (mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 2) {
    // If currently connecting, wait for it
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

    for (const order of expiredOrders) {
      if (order.currentRiderId) {
        order.assignmentHistory.push({
          riderId: order.currentRiderId,
          action: 'TIMEOUT',
          timestamp: new Date(),
        });

        await User.findByIdAndUpdate(order.currentRiderId, {
          status: 'AVAILABLE',
          $inc: { declineCount: 1 },
        });
      }

      order.status = 'PENDING_ASSIGNMENT';
      order.currentRiderId = undefined;
      order.offerExpiresAt = undefined;
      await order.save();
    }

    return NextResponse.json({ success: true, expiredProcessed: expiredOrders.length });
  } catch (error: any) {
    console.error('SERVER CRON ERROR (timeouts):', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}