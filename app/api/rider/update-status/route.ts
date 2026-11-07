// app/api/rider/update-status/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Order, User } from '@/lib/models';
import { logEvent } from '@/lib/utils/logger';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { orderId, riderId, status } = await request.json();

    const validStatuses = ['ARRIVED_STORE', 'PICKED_UP', 'ARRIVED_DROPOFF', 'DELIVERED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid order progress status.' }, { status: 400 });
    }

    const order = await Order.findOneAndUpdate(
      { _id: orderId, currentRiderId: riderId },
      { $set: { status } },
      { new: true }
    );

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found or not assigned to you.' }, { status: 404 });
    }

    // If delivered, free up the rider back to AVAILABLE and increment completed count/earnings
    if (status === 'DELIVERED') {
      await User.findByIdAndUpdate(riderId, { status: 'AVAILABLE' });
      order.currentRiderId = undefined; // Clear active assignment
      await order.save();
    }

    // **LOG PROGRESS UPDATE**
    await logEvent({
      userId: riderId,
      userRole: 'RIDER',
      action: `ORDER_PROGRESS_${status}`,
      targetId: order._id.toString(),
      details: { orderNumber: order.orderNumber, newStatus: status },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ success: true, message: `Order status updated to ${status}`, order });
  } catch (error: any) {
    console.error('Update Status Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}