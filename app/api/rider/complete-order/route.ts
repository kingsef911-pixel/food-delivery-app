// app/api/rider/complete/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Order, User } from '@/lib/models';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { orderId, riderId } = await request.json();

    if (!orderId || !riderId) {
      return NextResponse.json({ success: false, error: 'Missing orderId or riderId' }, { status: 400 });
    }

    const order = await Order.findById(orderId);
    const rider = await User.findById(riderId);

    if (!order || !rider) {
      return NextResponse.json({ success: false, error: 'Order or rider not found in database.' }, { status: 404 });
    }

    // 1. Mark order as DELIVERED
    order.status = 'DELIVERED';
    order.completedAt = new Date();
    
    // Safely push to assignmentHistory if the array exists
    if (!order.assignmentHistory) {
      order.assignmentHistory = [];
    }
    order.assignmentHistory.push({
      riderId: rider._id,
      action: 'DELIVERED',
      timestamp: new Date(),
    });
    await order.save();

    // 2. Return rider to AVAILABLE status at the bottom of the FIFO queue
    const highestQueueRider = await User.findOne({ role: 'RIDER', status: 'AVAILABLE' }).sort({ queuePosition: -1 });
    rider.status = 'AVAILABLE';
    rider.queuePosition = highestQueueRider ? highestQueueRider.queuePosition + 1 : 1;
    await rider.save();

    return NextResponse.json({
      success: true,
      message: 'Order delivered successfully! Rider placed back into FIFO queue.',
    });
  } catch (error: any) {
    console.error('Error completing order:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}