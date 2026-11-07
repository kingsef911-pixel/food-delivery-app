// app/rider/dispatch/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import axios from 'axios';
import { MapPin, Navigation, Phone, CheckCircle, XCircle, AlertTriangle, Clock, CheckCircle2, Store, Truck, Flag } from 'lucide-react';

function DispatchContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const riderId = searchParams.get('riderId');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId || !riderId) {
      setError('Invalid dispatch link. Missing credentials.');
      setLoading(false);
      return;
    }

    axios
      .get(`/api/rider/dispatch-info?orderId=${orderId}&riderId=${riderId}`)
      .then((res) => {
        setData(res.data);
        setOrderStatus(res.data.order.status);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load order details.');
        setLoading(false);
      });
  }, [orderId, riderId]);

  const handleAction = async (action: 'ACCEPT' | 'DECLINE') => {
    try {
      setActionLoading(true);
      const res = await axios.post('/api/rider/action', {
        orderId,
        riderId,
        action,
      });

      if (res.data.success) {
        setOrderStatus(action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED');
        const updated = await axios.get(`/api/rider/dispatch-info?orderId=${orderId}&riderId=${riderId}`);
        setData(updated.data);
      } else {
        alert(res.data.error || 'Action failed');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Network error processing action.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setActionLoading(true);
      const res = await axios.post('/api/rider/update-status', {
        orderId,
        riderId,
        newStatus,
      });

      if (res.data.success) {
        setOrderStatus(newStatus);
      } else {
        alert(res.data.error || 'Failed to update order status.');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Server error updating status.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <Clock className="w-10 h-10 animate-spin text-amber-400 mb-3" />
        <p className="text-lg font-medium">Loading incoming order...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-14 h-14 text-rose-500 mb-3" />
        <h1 className="text-xl font-bold mb-2">Unable to Load Order</h1>
        <p className="text-slate-400 text-sm">{error || 'Order not found.'}</p>
      </div>
    );
  }

  const { order, rider } = data;

  // 1. If order is DELIVERED
  if (orderStatus === 'DELIVERED') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Delivery Completed!</h1>
        <p className="text-slate-300 text-sm">Great job! You have been successfully placed back into the FIFO queue.</p>
      </div>
    );
  }

  // 2. If order is DECLINED or EXPIRED
  if (orderStatus === 'DECLINED' || orderStatus === 'EXPIRED') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <XCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Order Declined / Expired</h1>
        <p className="text-slate-400 text-sm">You have been moved to the bottom of the queue.</p>
      </div>
    );
  }

  // 3. Active Delivery Progress Dashboard (ACCEPTED, ARRIVED_STORE, PICKED_UP, ARRIVED_DROPOFF)
  if (['ACCEPTED', 'ARRIVED_STORE', 'PICKED_UP', 'ARRIVED_DROPOFF'].includes(orderStatus)) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 max-w-md mx-auto flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div>
              <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Active Delivery</span>
              <h1 className="text-xl font-black">{order.orderNumber}</h1>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Earnings</span>
              <span className="text-2xl font-black text-emerald-400">₱{order.deliveryFee}</span>
            </div>
          </div>

          {/* Distance & Info Summary Badge */}
          <div className="bg-slate-900/50 rounded-xl px-4 py-2.5 border border-slate-800 flex justify-between items-center text-xs text-slate-300">
            <span>Total Route Distance:</span>
            <span className="font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg">{order.distanceKm} km</span>
          </div>

          {/* Navigation & Details Card */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 space-y-4">
            <div>
              <span className="text-xs text-blue-400 font-semibold block uppercase">1. Pick-up Location</span>
              <p className="text-sm text-slate-200 mt-0.5">{order.pickupAddress}</p>
              <a href={order.pickupGmapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline mt-1 inline-block">Open Pickup Map ↗</a>
            </div>
            <div className="border-t border-slate-800 pt-3">
              <span className="text-xs text-emerald-400 font-semibold block uppercase">2. Drop-off Location</span>
              <p className="text-sm text-slate-200 mt-0.5">{order.dropoffAddress}</p>
              <a href={order.dropoffGmapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 underline mt-1 inline-block">Open Drop-off Map ↗</a>
            </div>
          </div>

          {/* Progressive Action Steps */}
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-2">Update Delivery Progress</h2>

            {orderStatus === 'ACCEPTED' && (
              <button
                onClick={() => handleUpdateStatus('ARRIVED_STORE')}
                disabled={actionLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                <Store className="w-5 h-5" /> {actionLoading ? 'Updating...' : 'Arrived at Store'}
              </button>
            )}

            {['ACCEPTED', 'ARRIVED_STORE'].includes(orderStatus) && (
              <button
                onClick={() => handleUpdateStatus('PICKED_UP')}
                disabled={actionLoading}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                <Truck className="w-5 h-5" /> {actionLoading ? 'Updating...' : 'Picked Up & En-Route'}
              </button>
            )}

            {['ACCEPTED', 'ARRIVED_STORE', 'PICKED_UP'].includes(orderStatus) && (
              <button
                onClick={() => handleUpdateStatus('ARRIVED_DROPOFF')}
                disabled={actionLoading}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                <Flag className="w-5 h-5" /> {actionLoading ? 'Updating...' : 'Arrived at Drop-off'}
              </button>
            )}

            <button
              onClick={() => handleUpdateStatus('DELIVERED')}
              disabled={actionLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 mt-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              {actionLoading ? 'Completing...' : 'Complete Order (Delivered)'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Initial Offer View (OFFERED)
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 max-w-md mx-auto flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">New Delivery Offer</span>
            <h1 className="text-xl font-black">{order.orderNumber}</h1>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Earnings</span>
            <span className="text-2xl font-black text-emerald-400">₱{order.deliveryFee}</span>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 space-y-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="bg-blue-500/20 p-2.5 rounded-xl text-blue-400 mt-1">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-xs text-blue-400 font-semibold block uppercase">Pick-up Location</span>
              <p className="text-sm font-medium text-slate-200 mt-0.5">{order.pickupAddress}</p>
              <a href={order.pickupGmapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline mt-1 inline-block">Open in Google Maps ↗</a>
            </div>
          </div>

          <div className="border-t border-slate-800 my-2" />

          <div className="flex items-start gap-3">
            <div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-400 mt-1">
              <Navigation className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-xs text-emerald-400 font-semibold block uppercase">Drop-off Location</span>
              <p className="text-sm font-medium text-slate-200 mt-0.5">{order.dropoffAddress}</p>
              <a href={order.dropoffGmapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 underline mt-1 inline-block">Open in Google Maps ↗</a>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800/80 text-sm space-y-2 mb-6">
          <div className="flex justify-between text-slate-400">
            <span>Distance:</span>
            <span className="text-white font-semibold">{order.distanceKm} km</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Customer:</span>
            <span className="text-white font-semibold">{order.customerName}</span>
          </div>
          {order.itemDescription && (
            <div className="flex justify-between text-slate-400">
              <span>Items:</span>
              <span className="text-white font-semibold">{order.itemDescription}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 pb-6">
        <button
          onClick={() => handleAction('ACCEPT')}
          disabled={actionLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 text-lg"
        >
          <CheckCircle className="w-6 h-6" /> {actionLoading ? 'Processing...' : 'Accept Order'}
        </button>
        <button
          onClick={() => handleAction('DECLINE')}
          disabled={actionLoading}
          className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 transition text-rose-400 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2"
        >
          <XCircle className="w-5 h-5" /> Decline Order
        </button>
      </div>
    </div>
  );
}

export default function RiderDispatchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>}>
      <DispatchContent />
    </Suspense>
  );
}