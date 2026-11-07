// app/api/orders/create/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Customer, Order } from '@/lib/models';
import { calculateDistanceAndFee } from '@/lib/utils/maps';
import { dispatchOrderToNextRider } from '@/lib/dispatch';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { 
      customerName, 
      customerPhone, 
      pickupAddress, 
      pickupGmapsUrl, 
      dropoffAddress, 
      dropoffGmapsUrl, 
      itemDescription,
      marketingOptIn 
    } = body;

    if (!customerName || !customerPhone || !pickupGmapsUrl || !dropoffGmapsUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required customer or location details.' },
        { status: 400 }
      );
    }

    // Pass all parameters and extract distance, fee, coordinates, and OSRM route geometry
    const { distanceKm, deliveryFee, pickupCoords, dropoffCoords, routeGeometry } = await calculateDistanceAndFee(
      pickupAddress, 
      dropoffAddress, 
      pickupGmapsUrl, 
      dropoffGmapsUrl
    );

    let customer = await Customer.findOne({ phone: customerPhone });
    if (!customer) {
      customer = await Customer.create({
        phone: customerPhone,
        name: customerName,
        defaultAddress: dropoffAddress,
        totalOrders: 1,
        totalSpent: deliveryFee,
        marketingOptIn: !!marketingOptIn,
        optInDate: marketingOptIn ? new Date() : undefined,
      });
    } else {
      customer.totalOrders += 1;
      customer.totalSpent += deliveryFee;
      customer.lastOrderAt = new Date();
      await customer.save();
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${randomNum}`;

    const newOrder = await Order.create({
      orderNumber,
      customerId: customer._id,
      customerName,
      customerPhone,
      pickupAddress: pickupAddress || pickupGmapsUrl,
      pickupGmapsUrl,
      pickupCoords,
      dropoffAddress: dropoffAddress || dropoffGmapsUrl,
      dropoffGmapsUrl,
      dropoffCoords,
      distanceKm,
      deliveryFee,
      routeGeometry, // <-- Saved OSRM polyline coordinate pairs
      itemDescription: itemDescription || '',
      status: 'PENDING_ASSIGNMENT',
      assignmentHistory: [],
    });

    const dispatchResult = await dispatchOrderToNextRider(newOrder._id.toString());

    return NextResponse.json({
      success: true,
      message: 'Order created and dispatched!',
      order: newOrder,
      dispatch: dispatchResult,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create Order Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}