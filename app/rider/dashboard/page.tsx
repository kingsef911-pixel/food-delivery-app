// app/rider/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Power, Package, CheckCircle2, AlertTriangle, TrendingUp, RefreshCw, Clock, ExternalLink, LogOut } from 'lucide-react';
import dynamic from 'next/dynamic';

const RiderMap = dynamic(() => import('@/components/RiderMap'), {
    ssr: false,
    loading: () => <div className="w-full h-64 bg-slate-900 rounded-xl flex items-center justify-center text-slate-500">Loading Map...</div>
});
export default function RiderPortal() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>({ rider: {}, activeOrder: null, metrics: {}, history: [] });
    const [actionLoading, setActionLoading] = useState(false);
    const router = useRouter();

    const fetchRiderData = async () => {
        try {
            const res = await axios.get('/api/rider/dashboard-data');
            if (res.data.success) {
                setData(res.data);
            }
        } catch (err: any) {
            console.error('Failed to load rider data', err);
            if (err.response?.status === 401) {
                router.push('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRiderData();
        const interval = setInterval(fetchRiderData, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        try {
            await axios.post('/api/auth/logout');
            router.push('/login');
        } catch (err) {
            alert('Logout failed');
        }
    };

    const handleToggleStatus = async () => {
        const currentStatus = data.rider?.status;
        const newStatus = currentStatus === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';

        try {
            const res = await axios.post('/api/rider/toggle-status', { riderId: data.rider?._id, status: newStatus });
            if (res.data.success) {
                fetchRiderData();
            } else {
                alert(res.data.error);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to update status.');
        }
    };

    const handleOrderAction = async (orderId: string, action: 'ACCEPT' | 'DECLINED') => {
        setActionLoading(true);
        try {
            const res = await axios.post('/api/rider/action', { orderId, riderId: data.rider?._id, action });
            if (res.data.success) {
                fetchRiderData();
            } else {
                alert(res.data.error);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Action failed.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleProgressUpdate = async (orderId: string, status: string) => {
        setActionLoading(true);
        try {
            const res = await axios.post('/api/rider/update-status', { orderId, riderId: data.rider?._id, status });
            if (res.data.success) {
                fetchRiderData();
            } else {
                alert(res.data.error);
            }
        } catch (err: any) {
            alert(err.response?.data?.error || 'Status update failed.');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && !data.rider?.name) {
        return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">Loading Rider Portal...</div>;
    }

    const { rider, activeOrder, metrics, history } = data;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header & Status Toggle Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">Rider Mobile Portal</span>
                        <h2 className="text-xl font-black mt-1">{rider.name || 'Rider Dashboard'}</h2>
                        <p className="text-xs text-slate-400 mt-1">Phone: {rider.phone || 'N/A'} | Queue Position: #{rider.queuePosition || 'N/A'}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {rider.status === 'BUSY' ? (
                            <span className="bg-amber-500/20 text-amber-400 px-4 py-2 rounded-xl font-bold text-sm border border-amber-500/30">
                                ⚡ Busy on Delivery
                            </span>
                        ) : (
                            <button
                                onClick={handleToggleStatus}
                                className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition ${
                                    rider.status === 'AVAILABLE'
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                }`}
                            >
                                <Power className="w-4 h-4" />
                                {rider.status === 'AVAILABLE' ? 'Online (Available)' : 'Offline'}
                            </button>
                        )}

                        <button
                            onClick={fetchRiderData}
                            className="bg-slate-800 hover:bg-slate-700 p-3 rounded-xl text-slate-300 transition"
                            title="Refresh Data"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>

                        <button
                            onClick={handleLogout}
                            className="bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800 text-rose-200 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition"
                            title="Sign Out"
                        >
                            <LogOut className="w-4 h-4" /> Logout
                        </button>
                    </div>
                </div>

                {rider.isSuspended && (
                    <div className="bg-rose-950/40 border border-rose-800 text-rose-200 p-4 rounded-2xl flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-rose-400" />
                        <div>
                            <h3 className="font-bold">Account Suspended</h3>
                            <p className="text-xs text-rose-300">Your account has been suspended due to compliance or decline limits. Please contact admin.</p>
                        </div>
                    </div>
                )}

                {/* Personal Performance Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <span className="text-xs text-slate-400 uppercase font-bold">Completed</span>
                        <div className="text-3xl font-black text-emerald-400 mt-1">{metrics.completedCount || 0}</div>
                        <span className="text-[11px] text-slate-500">Successful deliveries</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <span className="text-xs text-slate-400 uppercase font-bold">Total Earnings</span>
                        <div className="text-3xl font-black text-emerald-400 mt-1">₱{metrics.totalEarnings || 0}</div>
                        <span className="text-[11px] text-slate-500">From delivery fees</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <span className="text-xs text-slate-400 uppercase font-bold">Declines / Timeouts</span>
                        <div className={`text-3xl font-black mt-1 ${metrics.totalDeclines >= 3 ? 'text-rose-400' : 'text-slate-100'}`}>
                            {metrics.totalDeclines || 0}
                        </div>
                        <span className="text-[11px] text-slate-500">{metrics.declineRate || '0.0%'} decline rate</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <span className="text-xs text-slate-400 uppercase font-bold">Customer Rating</span>
                        <div className="text-2xl font-black text-amber-400 mt-1">⭐ {metrics.customerRating}</div>
                        <span className="text-[11px] text-slate-500">Platform average</span>
                    </div>
                </div>

                {/* Active Order Offer / Dispatch Widget */}
                {activeOrder && (
                    <div className={`bg-slate-900 border rounded-2xl p-6 shadow-xl ${activeOrder.status === 'OFFERED' ? 'border-amber-500 animate-pulse' : 'border-blue-600'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
                                    {activeOrder.status === 'OFFERED' ? 'New Delivery Offer' : 'Active Delivery'}
                                </span>
                                <h2 className="text-xl font-black">{activeOrder.orderNumber}</h2>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-slate-400">Earnings</span>
                                <div className="text-xl font-bold text-emerald-400">₱{activeOrder.deliveryFee}</div>
                            </div>
                        </div>

                        <div className="space-y-3 mb-6 bg-slate-950 p-4 rounded-xl text-sm">
                            <div>
                                <span className="text-xs text-slate-500 uppercase font-bold block">Pick-up Location</span>
                                <div className="font-medium text-slate-200">{activeOrder.pickupAddress}</div>
                                <a href={activeOrder.pickupGmapsUrl} target="_blank" rel="noreferrer" className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 mt-0.5">
                                    Open Pick-up Map <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                            <div className="border-t border-slate-900 pt-2">
                                <span className="text-xs text-slate-500 uppercase font-bold block">Drop-off Location</span>
                                <div className="font-medium text-slate-200">{activeOrder.dropoffAddress}</div>
                                <a href={activeOrder.dropoffGmapsUrl} target="_blank" rel="noreferrer" className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 mt-0.5">
                                    Open Drop-off Map <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>

                            {/* OSRM Route Navigation Map Component (Safeguarded) */}
                            {activeOrder.status !== 'OFFERED' && (activeOrder.pickupCoords || (activeOrder.routeGeometry && activeOrder.routeGeometry.length > 0)) && (
                                <div className="border-t border-slate-900 pt-3 mt-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs text-amber-400 uppercase font-bold">OSRM Live Route Navigation</span>
                                        <span className="text-xs font-bold text-slate-300">{activeOrder.distanceKm} km</span>
                                    </div>
                                    <div className="mb-3">
                                        <RiderMap
                                            pickupCoords={activeOrder.pickupCoords}
                                            dropoffCoords={activeOrder.dropoffCoords}
                                            routeGeometry={activeOrder.routeGeometry || []}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <a
                                            href={activeOrder.pickupGmapsUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold py-2.5 px-3 rounded-xl text-center transition flex items-center justify-center gap-1.5"
                                        >
                                            📍 Open Exact Pick-up Pin <ExternalLink className="w-3 h-3" />
                                        </a>
                                        <a
                                            href={activeOrder.dropoffGmapsUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold py-2.5 px-3 rounded-xl text-center transition flex items-center justify-center gap-1.5"
                                        >
                                            🏁 Open Exact Drop-off Pin <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            )}

                            {activeOrder.itemDescription && (
                                <div className="border-t border-slate-900 pt-2">
                                    <span className="text-xs text-slate-500 uppercase font-bold block">Items / Notes</span>
                                    <div className="text-slate-300">{activeOrder.itemDescription}</div>
                                </div>
                            )}
                        </div>

                        {activeOrder.status === 'OFFERED' ? (
                            <div className="flex gap-3">
                                <button
                                    disabled={actionLoading}
                                    onClick={() => handleOrderAction(activeOrder._id, 'ACCEPT')}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow transition"
                                >
                                    Accept Order
                                </button>
                                <button
                                    disabled={actionLoading}
                                    onClick={() => handleOrderAction(activeOrder._id, 'DECLINED')}
                                    className="flex-1 bg-rose-600/80 hover:bg-rose-600 text-white font-bold py-3.5 rounded-xl shadow transition"
                                >
                                    Decline Order
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    disabled={actionLoading || activeOrder.status !== 'ACCEPTED'}
                                    onClick={() => handleProgressUpdate(activeOrder._id, 'ARRIVED_STORE')}
                                    className={`py-3 px-4 rounded-xl font-bold text-xs transition ${activeOrder.status === 'ACCEPTED' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                >
                                    1. Arrived at Store
                                </button>
                                <button
                                    disabled={actionLoading || activeOrder.status !== 'ARRIVED_STORE'}
                                    onClick={() => handleProgressUpdate(activeOrder._id, 'PICKED_UP')}
                                    className={`py-3 px-4 rounded-xl font-bold text-xs transition ${activeOrder.status === 'ARRIVED_STORE' ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                >
                                    2. Picked Up & En-Route
                                </button>
                                <button
                                    disabled={actionLoading || activeOrder.status !== 'PICKED_UP'}
                                    onClick={() => handleProgressUpdate(activeOrder._id, 'ARRIVED_DROPOFF')}
                                    className={`py-3 px-4 rounded-xl font-bold text-xs transition ${activeOrder.status === 'PICKED_UP' ? 'bg-purple-600 hover:bg-purple-500 text-white shadow' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                >
                                    3. Arrived at Drop-off
                                </button>
                                <button
                                    disabled={actionLoading || activeOrder.status !== 'ARRIVED_DROPOFF'}
                                    onClick={() => handleProgressUpdate(activeOrder._id, 'DELIVERED')}
                                    className={`py-3 px-4 rounded-xl font-bold text-xs transition ${activeOrder.status === 'ARRIVED_DROPOFF' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                >
                                    4. Complete Order (Delivered)
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Personal Delivery History */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-lg font-bold mb-4">My Delivery History</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-800 text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="pb-3">Order #</th>
                                    <th className="pb-3">Destination</th>
                                    <th className="pb-3">Fee</th>
                                    <th className="pb-3">Status</th>
                                    <th className="pb-3">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {history.map((ord: any) => (
                                    <tr key={ord._id} className="hover:bg-slate-950/40">
                                        <td className="py-3 font-bold text-amber-400">{ord.orderNumber}</td>
                                        <td className="py-3 text-xs text-slate-300 max-w-xs truncate">{ord.dropoffAddress}</td>
                                        <td className="py-3 font-semibold text-emerald-400">₱{ord.deliveryFee}</td>
                                        <td className="py-3">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                                                ord.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' :
                                                ord.status === 'ABANDONED' ? 'bg-rose-500/20 text-rose-400 font-bold' :
                                                'bg-slate-800 text-slate-400'
                                            }`}>
                                                {ord.status}
                                            </span>
                                        </td>
                                        <td className="py-3 text-xs text-slate-400">
                                            {new Date(ord.createdAt).toLocaleDateString()} {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    </tr>
                                ))}
                                {history.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-6 text-slate-500">No delivery history found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}