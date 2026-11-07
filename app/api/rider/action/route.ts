// app/api/rider/action/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Order, User } from '@/lib/models';
import { handleRiderDecline, dispatchOrderToNextRider } from '@/lib/dispatch';
import { logEvent } from '@/lib/utils/logger'; // <-- Import audit logger

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { orderId, riderId, action } = await request.json();

    if (!orderId || !riderId || !action) {
      return NextResponse.json({ success: false, error: 'Missing required parameters.' }, { status: 400 });
    }

    const rider = await User.findById(riderId);
    if (!rider) {
      return NextResponse.json({ success: false, error: 'Rider not found.' }, { status: 404 });
    }

    if (action === 'DECLINE') {
      // Handle decline using your hardened decline handler (which already includes logging)
      const result = await handleRiderDecline(orderId, riderId);
      return NextResponse.json(result);
    }

    if (action === 'ACCEPT') {
      // Atomically claim the offered order
      const order = await Order.findOneAndUpdate(
        { _id: orderId, status: 'OFFERED', currentRiderId: riderId },
        { 
          $set: { status: 'ACCEPTED', offerExpiresAt: null },
          $push: { assignmentHistory: { riderId: rider._id, action: 'ACCEPTED', timestamp: new Date() } }
        },
        { new: true }
      );

      if (!order) {
        return NextResponse.json({ success: false, error: 'Order is no longer offered to you or has timed out.' }, { status: 400 });
      }

      // Keep rider status as BUSY
      rider.status = 'BUSY';
      await rider.save();

      // **LOG RIDER ACCEPTANCE**
      await logEvent({
        userId: rider._id.toString(),
        userRole: 'RIDER',
        action: 'ORDER_ACCEPTED',
        targetId: order._id.toString(),
        details: { orderNumber: order.orderNumber, riderName: rider.name },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      });

      return NextResponse.json({ success: true, message: 'Order accepted successfully!', order });
    }

    return NextResponse.json({ success: false, error: 'Invalid action type.' }, { status: 400 });

  } catch (error: any) {
    console.error('Rider Action Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}