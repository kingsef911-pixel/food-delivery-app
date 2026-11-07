// app/admin/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { PlusCircle, Users, Package, RefreshCw, Clock, BarChart2, TrendingUp, CheckCircle2, AlertTriangle, XCircle, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';

const AdminCommandMap = dynamic(() => import('@/components/AdminCommandMap'), {
  ssr: false,
  loading: () => <div className="w-full h-[500px] bg-slate-900 rounded-2xl flex items-center justify-center text-slate-500">Loading Command Map...</div>
});

function LiveTimer({ startTime, status }: { startTime: string; status: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startTime || ['DELIVERED', 'CANCELLED', 'ABANDONED'].includes(status)) return;

    const updateTimer = () => {
      const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsed(`${mins}m ${secs}s`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [startTime, status]);

  return <span className="text-amber-400 font-semibold flex items-center gap-1"><Clock className="w-3.5 h-3.5 animate-spin" /> {elapsed || '0m 0s'}</span>;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'dispatch' | 'performance' | 'ordermetrics'>('dispatch');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>({ riders: [], orders: [], orderMetrics: {} });

  // Pagination state for orders list
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 6;

  const router = useRouter();

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    pickupAddress: 'Store Hub, San Miguel, Bulacan',
    pickupGmapsUrl: 'https://maps.google.com/?q=Store+Hub',
    dropoffAddress: '',
    dropoffGmapsUrl: '',
    itemDescription: '',
    marketingOptIn: true,
  });

  const fetchDashboardData = async () => {
    try {
      const res = await axios.get('/api/admin/dashboard-data');
      if (res.data.success) {
        setDashboardData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const dataInterval = setInterval(fetchDashboardData, 10000);
    const timeoutInterval = setInterval(async () => {
      try {
        await axios.get('/api/cron/check-timeouts');
        await axios.get('/api/cron/check-abandoned');
      } catch (err) {
        console.error('Cron check failed', err);
      }
    }, 5000);

    return () => {
      clearInterval(dataInterval);
      clearInterval(timeoutInterval);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
      router.push('/login');
    } catch (err) {
      alert('Logout failed');
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await axios.post('/api/orders/create', formData);
      if (res.data.success) {
        alert(`Order ${res.data.order.orderNumber} created and dispatched successfully!`);
        setFormData({
          customerName: '',
          customerPhone: '',
          pickupAddress: 'Store Hub, San Miguel, Bulacan',
          pickupGmapsUrl: 'https://maps.google.com/?q=Store+Hub',
          dropoffAddress: '',
          dropoffGmapsUrl: '',
          itemDescription: '',
          marketingOptIn: true,
        });
        fetchDashboardData();
      } else {
        alert(res.data.error || 'Failed to create order');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Server error creating order.');
    } finally {
      setSubmitting(false);
    }
  };

  const metrics = dashboardData.orderMetrics || {};
  const orders = dashboardData.orders || [];

  // Pagination calculations
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(orders.length / ordersPerPage) || 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Top Header & Navigation Tabs */}
      <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row justify-between items-center mb-8 bg-slate-900/80 backdrop-blur p-5 rounded-2xl border border-slate-800 gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">Admin Dispatch Hub</span>
          <h1 className="text-2xl font-black">Food Delivery Command Center</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex flex-wrap">
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'dispatch' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Package className="w-4 h-4" /> Dispatch Center
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'performance' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Users className="w-4 h-4" /> Rider Performance
            </button>
            <button
              onClick={() => setActiveTab('ordermetrics')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'ordermetrics' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <TrendingUp className="w-4 h-4" /> Order Metrics
            </button>
          </div>

          <button
            onClick={fetchDashboardData}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>

          <button
            onClick={handleLogout}
            className="bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800 text-rose-200 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {activeTab === 'dispatch' ? (
        <div className="max-w-[1600px] mx-auto space-y-8">

          {/* Top 3-Column Fixed Layout: Form (Left), Map (Center), Queue (Right) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

            {/* 1. New Order Entry Form (Left - 3 Cols) */}
            <div className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-amber-500/20 p-2 rounded-xl text-amber-400">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">New Order Entry</h2>
                  <p className="text-[11px] text-slate-400">Guest checkout with auto-profiling</p>
                </div>
              </div>

              <form onSubmit={handleCreateOrder} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juan dela Cruz"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 09123456789"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Pick-up Location & Maps Link</label>
                  <input
                    type="text"
                    required
                    value={formData.pickupAddress}
                    onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs mb-1.5 focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="url"
                    required
                    placeholder="Google Maps URL"
                    value={formData.pickupGmapsUrl}
                    onChange={(e) => setFormData({ ...formData, pickupGmapsUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Drop-off Address & Maps Link</label>
                  <input
                    type="text"
                    required
                    placeholder="Complete Delivery Address"
                    value={formData.dropoffAddress}
                    onChange={(e) => setFormData({ ...formData, dropoffAddress: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs mb-1.5 focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="url"
                    required
                    placeholder="Google Maps URL or Pin Link"
                    value={formData.dropoffGmapsUrl}
                    onChange={(e) => setFormData({ ...formData, dropoffGmapsUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">Item Description / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. 2x Fried Chicken Meal"
                    value={formData.itemDescription}
                    onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl shadow-lg transition mt-2 text-xs uppercase tracking-wider"
                >
                  {submitting ? 'Dispatching...' : 'Create & Dispatch Order'}
                </button>
              </form>
            </div>

            {/* 2. Admin Command Map (Center - 6 Cols) */}
            <div className="xl:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold">Live Fleet Command Map</h2>
                  <p className="text-[11px] text-slate-400">Real-time OSRM route tracking & active order pins</p>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-semibold">
                  Live Sync Active
                </span>
              </div>
              <AdminCommandMap activeOrders={orders.filter((o: any) => ['ACCEPTED', 'ARRIVED_STORE', 'PICKED_UP', 'ARRIVED_DROPOFF'].includes(o.status))} />
            </div>

            {/* 3. Rider FIFO Queue & Compliance (Right - 3 Cols) */}
            <div className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-500/20 p-2 rounded-xl text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold">Rider Queue</h2>
                </div>
                <span className="text-[11px] bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-300">
                  {dashboardData.riders.length} Registered
                </span>
              </div>

              {/* Max height restricted to ~3 cards (410px) with custom scrollbar */}
              <div className="space-y-3 max-h-[410px] overflow-y-auto pr-1 custom-scrollbar">
                {dashboardData.riders.map((rider: any) => {
                  const pendingIRs = rider.incidentReports?.filter((ir: any) => ir.status === 'PENDING_REVIEW').length || 0;

                  return (
                    <div key={rider._id} className={`bg-slate-950 border p-3 rounded-xl flex flex-col justify-between ${rider.isSuspended ? 'border-rose-800 bg-rose-950/10' : 'border-slate-800/80'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-xs">{rider.name}</h3>
                            {rider.isSuspended && (
                              <span className="bg-rose-500 text-slate-950 text-[9px] font-black px-1 py-0.2 rounded uppercase">
                                Suspended
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">{rider.phone}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold inline-block mb-0.5 ${rider.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-400' :
                              rider.status === 'BUSY' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                            {rider.status}
                          </span>
                          <span className="text-[10px] text-slate-500 block">Pos: #{rider.queuePosition}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-900 pt-1.5 mt-1.5 flex items-center justify-between text-[11px]">
                        <div>
                          {rider.activeOrder ? (
                            <span className="text-blue-400 font-semibold">📦 {rider.activeOrder.orderNumber}</span>
                          ) : (
                            <span className="text-slate-500">No active dispatch</span>
                          )}
                        </div>
                        <div className="text-slate-400 flex items-center gap-2">
                          <span>Declines: <strong className={rider.declineCount >= 3 ? 'text-rose-400' : 'text-white'}>{rider.declineCount || 0}</strong></span>
                          <span>IRs: <strong className={pendingIRs > 0 ? 'text-amber-400' : 'text-white'}>{pendingIRs}</strong></span>
                        </div>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-900 flex justify-end gap-1.5">
                        {rider.isSuspended ? (
                          <button
                            onClick={async () => {
                              const notes = prompt("Enter notes on valid rider explanation:");
                              if (notes) {
                                await axios.post('/api/admin/rider/lift-suspension', { riderId: rider._id, actionNotes: notes });
                                fetchDashboardData();
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-2 py-1 rounded-lg font-bold transition"
                          >
                            Lift Suspension
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              const reason = prompt("Enter Incident Report (IR) reason:");
                              const docUrl = prompt("Enter IR document/image URL (optional):");
                              if (reason) {
                                await axios.post('/api/admin/rider/file-ir', { riderId: rider._id, reason, documentUrl: docUrl });
                                fetchDashboardData();
                              }
                            }}
                            className="bg-amber-600/80 hover:bg-amber-600 text-slate-950 text-[10px] px-2 py-1 rounded-lg font-bold transition"
                          >
                            File IR
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Live Orders Tracker & Timing (Full Width Below with Pagination) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Live Orders Tracker & Timing</h2>
                  <p className="text-xs text-slate-400">Showing page {currentPage} of {totalPages} ({orders.length} total orders)</p>
                </div>
              </div>

              {/* Pagination Controls Top */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed p-2 rounded-xl text-slate-300 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold px-3 py-1 bg-slate-950 rounded-xl border border-slate-800">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed p-2 rounded-xl text-slate-300 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[320px]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="pb-3">Order #</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Assigned Rider</th>
                    <th className="pb-3">Destination</th>
                    <th className="pb-3">Fee</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Delivery Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentOrders.map((order: any) => {
                    let displayDuration = 'N/A';
                    if (order.status === 'DELIVERED') {
                      const start = new Date(order.acceptedAt || order.createdAt).getTime();
                      const end = new Date(order.completedAt || order.updatedAt).getTime();
                      const totalSecs = Math.max(1, Math.floor((end - start) / 1000));
                      const mins = Math.floor(totalSecs / 60);
                      const secs = totalSecs % 60;
                      displayDuration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                    }

                    return (
                      <tr key={order._id} className="hover:bg-slate-950/40">
                        <td className="py-3 font-bold text-amber-400">{order.orderNumber}</td>
                        <td className="py-3">
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-xs text-slate-500">{order.customerPhone}</div>
                        </td>
                        <td className="py-3">
                          {order.currentRiderId ? (
                            <div>
                              <span className="font-semibold text-slate-200">{order.currentRiderId.name}</span>
                              <span className="block text-xs text-slate-500">{order.currentRiderId.phone}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-500/80 italic">Unassigned / Offering</span>
                          )}
                        </td>
                        <td className="py-3 text-xs text-slate-300 max-w-xs truncate">{order.dropoffAddress}</td>
                        <td className="py-3 font-semibold text-emerald-400">₱{order.deliveryFee}</td>
                        <td className="py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${order.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' :
                              order.status === 'ACCEPTED' ? 'bg-blue-500/20 text-blue-400' :
                                order.status === 'ABANDONED' ? 'bg-rose-500/20 text-rose-500 font-bold' :
                                  order.status === 'OFFERED' ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
                                    'bg-slate-800 text-slate-400'
                            }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 text-xs font-mono">
                          {order.status === 'DELIVERED' ? (
                            <span className="text-emerald-400 font-bold">
                              {displayDuration} total
                            </span>
                          ) : order.status === 'ABANDONED' ? (
                            <span className="text-rose-500 font-bold">Abandoned</span>
                          ) : (
                            <LiveTimer startTime={order.acceptedAt || order.createdAt} status={order.status} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {currentOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">No orders created yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
                <span className="text-xs text-slate-400">
                  Showing {indexOfFirstOrder + 1} to {Math.min(indexOfLastOrder, orders.length)} of {orders.length} orders
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 transition flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 transition flex items-center gap-1"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      ) : activeTab === 'performance' ? (
        <div className="max-w-7xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-400">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Rider Performance Metrics</h2>
              <p className="text-xs text-slate-400">Comprehensive overview of completed orders, declines, timeouts, and ratings</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="pb-3">Rider Name</th>
                  <th className="pb-3 text-center">Completed</th>
                  <th className="pb-3 text-center">Manual Declines</th>
                  <th className="pb-3 text-center">Timeout Declines</th>
                  <th className="pb-3 text-center">Total Declines</th>
                  <th className="pb-3 text-center">Abandoned</th>
                  <th className="pb-3 text-center">Customer Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dashboardData.riders.map((rider: any) => {
                  const perf = rider.performance || {};
                  return (
                    <tr key={rider._id} className="hover:bg-slate-950/40">
                      <td className="py-4">
                        <div className="font-bold text-slate-100">{rider.name}</div>
                        <div className="text-xs text-slate-400">{rider.phone}</div>
                      </td>
                      <td className="py-4 text-center">
                        <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold text-xs">
                          {perf.completedCount || 0}
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        <div className="font-semibold text-slate-200">{perf.manualDeclines || 0}</div>
                        <div className="text-[11px] text-slate-400">{perf.manualDeclineRate || '0.0'}% rate</div>
                      </td>
                      <td className="py-4 text-center">
                        <div className="font-semibold text-slate-200">{perf.timeoutDeclines || 0}</div>
                        <div className="text-[11px] text-slate-400">{perf.timeoutDeclineRate || '0.0'}% rate</div>
                      </td>
                      <td className="py-4 text-center">
                        <div className={`font-bold ${(perf.totalDeclines || 0) >= 3 ? 'text-rose-400' : 'text-slate-100'}`}>
                          {perf.totalDeclines || 0}
                        </div>
                        <div className="text-[11px] text-slate-400">{perf.totalDeclineRate || '0.0'}% overall</div>
                      </td>
                      <td className="py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${(perf.abandonedCount || 0) > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
                          {perf.abandonedCount || 0}
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-bold text-xs inline-flex items-center gap-1">
                          ⭐ {perf.customerRating}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-amber-500/20 p-2.5 rounded-xl text-amber-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Platform Order Analytics & Metrics</h2>
                <p className="text-xs text-slate-400">Summary of total order volumes, completion ratios, revenues, and average delivery times</p>
              </div>
            </div>

            {/* Metric Summary Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase font-bold tracking-wider">Total Orders</span>
                  <Package className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-3xl font-black">{metrics.totalOrdersCount || 0}</div>
                <div className="text-xs text-slate-500 mt-1">Platform lifetime volume</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase font-bold tracking-wider">Completed Orders</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-emerald-400">{metrics.deliveredCount || 0}</div>
                <div className="text-xs text-emerald-500/80 mt-1 font-semibold">{metrics.completionRate}% completion rate</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase font-bold tracking-wider">Abandoned Orders</span>
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div className="text-3xl font-black text-rose-400">{metrics.abandonedCount || 0}</div>
                <div className="text-xs text-rose-500/80 mt-1 font-semibold">{metrics.abandonmentRate}% abandonment rate</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase font-bold tracking-wider">Delivery Revenue</span>
                  <span className="text-emerald-400 font-bold">₱</span>
                </div>
                <div className="text-3xl font-black text-emerald-400">₱{metrics.totalRevenue || 0}</div>
                <div className="text-xs text-slate-500 mt-1">From completed delivery fees</div>
              </div>
            </div>

            {/* Additional Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-semibold">Average Delivery Time</span>
                  <h3 className="text-xl font-bold mt-1 text-amber-400">{metrics.avgDeliveryTimeString}</h3>
                </div>
                <Clock className="w-8 h-8 text-amber-400/30" />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-semibold">Cancelled / Active Orders</span>
                  <h3 className="text-xl font-bold mt-1 text-slate-200">
                    {metrics.cancelledCount || 0} Cancelled / {metrics.activeOrdersCount || 0} Active
                  </h3>
                </div>
                <XCircle className="w-8 h-8 text-slate-500/30" />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}