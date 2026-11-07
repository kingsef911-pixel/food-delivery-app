// app/api/rider/action/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Order, User } from '@/lib/models';
import { handleRiderDecline } from '@/lib/dispatch';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { orderId, riderId, action } = await request.json();

    const order = await Order.findById(orderId);
    const rider = await User.findById(riderId);

    if (!order || !rider) {
      return NextResponse.json({ success: false, error: 'Order or rider not found.' }, { status: 404 });
    }

    // Verify that the order is currently offered to this specific rider
    if (order.status !== 'OFFERED' || order.currentRiderId?.toString() !== riderId) {
      return NextResponse.json({ success: false, error: 'This order offer has expired or is no longer assigned to you.' }, { status: 400 });
    }

    if (action === 'ACCEPT') {
      // 1. Update order to ACCEPTED and keep currentRiderId set to this rider
      order.status = 'ACCEPTED';
      order.currentRiderId = rider._id; // <-- CRITICAL: Keep currentRiderId assigned!
      order.offerExpiresAt = undefined;
      order.acceptedAt = new Date();
      order.assignmentHistory.push({
        riderId: rider._id,
        action: 'ACCEPTED',
        timestamp: new Date(),
      });
      await order.save();

      // 2. Set rider status to BUSY (on active delivery duty)
      rider.status = 'BUSY';
      await rider.save();

      return NextResponse.json({ success: true, message: 'Order successfully accepted!' });

    } else if (action === 'DECLINE') {
      // 1. Flip rider status back to AVAILABLE and delegate to handleRiderDecline routine
      rider.status = 'AVAILABLE';
      await rider.save();

      const result = await handleRiderDecline(orderId, riderId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Invalid action type.' }, { status: 400 });

  } catch (error: any) {
    console.error('Rider Action Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}