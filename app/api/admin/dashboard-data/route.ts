// app/api/admin/dashboard-data/route.ts
import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    await ensureDB();

    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .populate('currentRiderId', 'name phone')
      .lean();

    const rawRiders = await User.find({ role: 'RIDER' }).lean();

    // Calculate Platform-Wide Order Metrics
    let totalOrdersCount = orders.length;
    let deliveredCount = 0;
    let abandonedCount = 0;
    let cancelledCount = 0;
    let activeOrdersCount = 0;
    let totalRevenue = 0;
    let totalDeliverySeconds = 0;
    let deliveredWithTimeCount = 0;

    for (const ord of orders) {
      if (ord.status === 'DELIVERED') {
        deliveredCount++;
        totalRevenue += ord.deliveryFee || 0;

        if (ord.acceptedAt && ord.completedAt) {
          const start = new Date(ord.acceptedAt).getTime();
          const end = new Date(ord.completedAt).getTime();
          const secs = Math.floor((end - start) / 1000);
          if (secs > 0) {
            totalDeliverySeconds += secs;
            deliveredWithTimeCount++;
          }
        }
      } else if (ord.status === 'ABANDONED') {
        abandonedCount++;
      } else if (ord.status === 'CANCELLED') {
        cancelledCount++;
      } else {
        activeOrdersCount++;
      }
    }

    const completionRate = totalOrdersCount > 0 ? ((deliveredCount / totalOrdersCount) * 100).toFixed(1) : '0.0';
    const abandonmentRate = totalOrdersCount > 0 ? ((abandonedCount / totalOrdersCount) * 100).toFixed(1) : '0.0';
    const avgDeliverySeconds = deliveredWithTimeCount > 0 ? Math.floor(totalDeliverySeconds / deliveredWithTimeCount) : 0;
    const avgMins = Math.floor(avgDeliverySeconds / 60);
    const avgSecs = avgDeliverySeconds % 60;
    const avgDeliveryTimeString = deliveredWithTimeCount > 0 ? `${avgMins}m ${avgSecs}s` : 'N/A';

    const orderMetrics = {
      totalOrdersCount,
      deliveredCount,
      abandonedCount,
      cancelledCount,
      activeOrdersCount,
      totalRevenue,
      completionRate,
      abandonmentRate,
      avgDeliveryTimeString,
    };

    // Calculate Rider Performance Metrics
    const riders = await Promise.all(
      rawRiders.map(async (rider) => {
        const riderIdStr = rider._id.toString();

        const activeOrder = await Order.findOne({
          currentRiderId: rider._id,
          status: { $in: ['ACCEPTED', 'ARRIVED_STORE', 'PICKED_UP', 'ARRIVED_DROPOFF'] },
        }).lean();

        const riderOrders = await Order.find({
          $or: [
            { currentRiderId: rider._id },
            { 'assignmentHistory.riderId': rider._id }
          ]
        }).lean();

        let completedCount = 0;
        let manualDeclines = 0;
        let timeoutDeclines = 0;
        let totalOffered = 0;
        let rAbandonedCount = 0;

        for (const ord of riderOrders) {
          if (ord.status === 'DELIVERED') {
            const wasAssigned = ord.currentRiderId?.toString() === riderIdStr ||
              ord.assignmentHistory?.some((h: any) => h.riderId?.toString() === riderIdStr && h.action === 'ACCEPTED');
            if (wasAssigned) completedCount++;
          }

          if (ord.status === 'ABANDONED' && ord.currentRiderId?.toString() === riderIdStr) {
            rAbandonedCount++;
          }

          if (ord.assignmentHistory && Array.isArray(ord.assignmentHistory)) {
            const offerEntries = ord.assignmentHistory.filter(
              (h: any) => h.riderId?.toString() === riderIdStr && h.action === 'OFFERED'
            );
            totalOffered += offerEntries.length;

            for (const history of ord.assignmentHistory) {
              if (history.riderId?.toString() === riderIdStr) {
                if (history.action === 'DECLINED') manualDeclines++;
                if (history.action === 'TIMEOUT') timeoutDeclines++;
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
        }

        const totalDeclines = manualDeclines + timeoutDeclines;
        const manualDeclineRate = totalOffered > 0 ? ((manualDeclines / totalOffered) * 100).toFixed(1) : '0.0';
        const timeoutDeclineRate = totalOffered > 0 ? ((timeoutDeclines / totalOffered) * 100).toFixed(1) : '0.0';
        const totalDeclineRate = totalOffered > 0 ? ((totalDeclines / totalOffered) * 100).toFixed(1) : '0.0';

        return {
          ...rider,
          activeOrder,
          performance: {
            completedCount,
            manualDeclines,
            manualDeclineRate,
            timeoutDeclines,
            timeoutDeclineRate,
            totalDeclines,
            totalDeclineRate,
            abandonedCount: rAbandonedCount,
            totalOffered,
            customerRating: '4.8 / 5.0'
          },
          declineCount: totalDeclines,
          incidentReports: rider.incidentReports || [],
          isSuspended: rider.isSuspended || false,
        };
      })
    );

    return NextResponse.json({ success: true, riders, orders, orderMetrics });
  } catch (error: any) {
    console.error('Dashboard Data Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}