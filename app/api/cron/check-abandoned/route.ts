import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { Order, User } from '@/lib/models';

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
    const THIRTY_MINUTES_AGO = new Date(Date.now() - 30 * 60 * 1000);

    const stuckOrders = await Order.find({
      status: { $in: ['ACCEPTED', 'ARRIVED_STORE', 'PICKED_UP', 'ARRIVED_DROPOFF'] },
      updatedAt: { $lt: THIRTY_MINUTES_AGO },
    });

    for (const order of stuckOrders) {
      order.status = 'ABANDONED';
      await order.save();

      if (order.currentRiderId) {
        await User.findByIdAndUpdate(order.currentRiderId, {
          status: 'AVAILABLE',
        });
      }
    }

    return NextResponse.json({ success: true, abandonedCount: stuckOrders.length });
  } catch (error: any) {
    console.error('SERVER CRON ERROR (abandoned):', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}