// app/api/rider/toggle-status/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { User } from '@/lib/models';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { riderId, status } = await request.json();

    if (!['AVAILABLE', 'OFFLINE'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status toggle.' }, { status: 400 });
    }

    const rider = await User.findById(riderId);
    if (!rider) {
      return NextResponse.json({ success: false, error: 'Rider not found.' }, { status: 404 });
    }

    if (rider.isSuspended) {
      return NextResponse.json({ success: false, error: 'Account is suspended. Contact admin.' }, { status: 403 });
    }

    if (rider.status === 'BUSY' && status === 'OFFLINE') {
      return NextResponse.json({ success: false, error: 'Cannot go offline while handling an active delivery.' }, { status: 400 });
    }

    rider.status = status;
    await rider.save();

    return NextResponse.json({ success: true, status: rider.status });
  } catch (error: any) {
    console.error('Toggle Status Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}