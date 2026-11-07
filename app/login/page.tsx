// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Lock, User, ArrowRight } from 'lucide-react';

export default function LoginPage() {
    const [emailOrPhone, setEmailOrPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await axios.post('/api/auth/login', { emailOrPhone, password });
            if (res.data.success) {
                const { role, id } = res.data.user;
                // Redirect based on role
                if (role === 'ADMIN') {
                    router.push('/admin/dashboard'); // or your admin route
                } else {
                    router.push('/rider/dashboard');
                }
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
                <div>
                    <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">Logistics Access Portal</span>
                    <h1 className="text-2xl font-black mt-1">Sign In</h1>
                    <p className="text-xs text-slate-400 mt-1">Enter your credentials to access your account.</p>
                </div>

                {error && (
                    <div className="bg-rose-950/40 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Username / Phone / Email</label>
                        <div className="relative">
                            <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                            <input
                                type="text"
                                required
                                value={emailOrPhone}
                                onChange={(e) => setEmailOrPhone(e.target.value)}
                                placeholder="e.g. 09170000001 or admin"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 pl-9 text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Password</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 pl-9 text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                    >
                        {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}