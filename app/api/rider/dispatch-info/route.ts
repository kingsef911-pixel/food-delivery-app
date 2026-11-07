// app/api/rider/dispatch-info/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Order, User } from '@/lib/models';

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const riderId = searchParams.get('riderId');

    if (!orderId || !riderId) {
      return NextResponse.json({ success: false, error: 'Missing orderId or riderId parameters.' }, { status: 400 });
    }

    const order = await Order.findById(orderId);
    const rider = await User.findById(riderId);

    if (!order || !rider) {
      return NextResponse.json({ success: false, error: 'Order or Rider not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      order,
      rider: { name: rider.name, phone: rider.phone, status: rider.status },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}