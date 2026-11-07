// app/api/rider/dashboard-data/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import mongoose from 'mongoose';
import { User, Order } from '@/lib/models';

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

export async function GET(request: Request) {
  try {
    await ensureDB();
    const { searchParams } = new URL(request.url);
    let riderId = searchParams.get('riderId');

    // Fallback: If no riderId is in query params, read it from the secure session cookie (AWAITED for Next.js 15/16)
    if (!riderId) {
      const cookieStore = await cookies();
      riderId = cookieStore.get('session_user_id')?.value || null;
    }

    if (!riderId || !mongoose.Types.ObjectId.isValid(riderId)) {
      return NextResponse.json({ success: false, error: 'Unauthorized or invalid Rider session.' }, { status: 401 });
    }

    const rider = await User.findById(riderId).lean();
    if (!rider || rider.role !== 'RIDER') {
      return NextResponse.json({ success: false, error: 'Rider not found.' }, { status: 404 });
    }

    // Check for active order offered or assigned to this rider
    const activeOrder = await Order.findOne({
      $or: [
        { currentRiderId: rider._id, status: { $in: ['OFFERED', 'ACCEPTED', 'ARRIVED_STORE', 'PICKED_UP', 'ARRIVED_DROPOFF'] } }
      ]
    }).lean();

    // Fetch all history orders involving this rider
    const historyOrders = await Order.find({
      $or: [
        { currentRiderId: rider._id },
        { 'assignmentHistory.riderId': rider._id }
      ]
    }).sort({ updatedAt: -1 }).lean();

    let completedCount = 0;
    let totalEarnings = 0;
    let manualDeclines = 0;
    let timeoutDeclines = 0;
    let totalOffered = 0;
    let personalHistoryList = [];

    const riderIdStr = rider._id.toString();

    for (const ord of historyOrders) {
      const isCompletedByMe = ord.status === 'DELIVERED' && (
        ord.currentRiderId?.toString() === riderIdStr ||
        ord.assignmentHistory?.some((h: any) => h.riderId?.toString() === riderIdStr && h.action === 'ACCEPTED')
      );

      if (isCompletedByMe) {
        completedCount++;
        totalEarnings += ord.deliveryFee || 0;
      }

      // Track personal offer/decline history
      if (ord.assignmentHistory && Array.isArray(ord.assignmentHistory)) {
        const offerEntries = ord.assignmentHistory.filter(
          (h: any) => h.riderId?.toString() === riderIdStr && h.action === 'OFFERED'
        );
        totalOffered += offerEntries.length;

        for (const entry of ord.assignmentHistory) {
          if (entry.riderId?.toString() === riderIdStr) {
            if (entry.action === 'DECLINED') manualDeclines++;
            if (entry.action === 'TIMEOUT') timeoutDeclines++;
          }
        }

        const didAccept = ord.assignmentHistory.some(
          (h: any) => h.riderId?.toString() === riderIdStr && h.action === 'ACCEPTED'
        );

        if (!didAccept && offerEntries.length > 0) {
          const explicitRecorded = ord.assignmentHistory.filter(
            (h: any) => h.riderId?.toString() === riderIdStr && (h.action === 'DECLINED' || h.action === 'TIMEOUT')
          ).length;

          if (explicitRecorded === 0) {
            manualDeclines += offerEntries.length;
          }
        }
      }

      const touched = ord.currentRiderId?.toString() === riderIdStr || ord.assignmentHistory?.some((h: any) => h.riderId?.toString() === riderIdStr);
      if (touched) {
        personalHistoryList.push(ord);
      }
    }

    const totalDeclines = manualDeclines + timeoutDeclines;
    const declineRate = totalOffered > 0 ? ((totalDeclines / totalOffered) * 100).toFixed(1) : '0.0';

    return NextResponse.json({
      success: true,
      rider: {
        _id: rider._id,
        name: rider.name,
        phone: rider.phone,
        status: rider.status,
        queuePosition: rider.queuePosition,
        isSuspended: rider.isSuspended || false,
      },
      activeOrder,
      metrics: {
        completedCount,
        totalEarnings,
        totalOffered,
        manualDeclines,
        timeoutDeclines,
        totalDeclines,
        declineRate,
        customerRating: '4.8 / 5.0'
      },
      history: personalHistoryList
    });

  } catch (error: any) {
    console.error('Rider Dashboard Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}