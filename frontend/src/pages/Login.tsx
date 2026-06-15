import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { api } from '../services/api';
import { KeyRound, Smartphone, Loader2, GraduationCap, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { setAuth, showToast } = useAppStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post('/api/auth/login', { username, password });
      setAuth(data.token, data.user, data.school, data.activeAcademicYear);
      showToast(`Logged in successfully! Welcome, ${data.user.name}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Login failed. Please check your credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Top tricolor accent */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-orange-500 via-white to-brand-green-600" />

      {/* Background orbs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-orange-100/40 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-green-100/30 rounded-full blur-3xl" />

      {/* Card */}
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-slate-100 shadow-xl p-8 relative">

        {/* School Identity */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              boxShadow: '0 8px 24px rgba(249, 115, 22, 0.3)',
            }}
          >
            <GraduationCap size={30} className="text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-800 text-center leading-tight">
            Shantiniketan Public School
          </h1>
          <p className="text-xs text-slate-400 tracking-[0.15em] uppercase mt-1.5 font-semibold">
            ERP Portal • Chapetla
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Sign In</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Smartphone size={16} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <KeyRound size={16} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange-500 focus:border-brand-orange-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-3 text-white text-sm font-bold rounded-xl transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group"
            style={{
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              boxShadow: '0 4px 16px rgba(249, 115, 22, 0.25)',
            }}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Authenticating...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-5 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Having trouble logging in? Contact the school office.
          </p>
        </div>
      </div>

      {/* Bottom branding */}
      <p className="mt-5 text-[10px] text-slate-400 tracking-wider">
        School ERP Management System
      </p>
    </div>
  );
};
