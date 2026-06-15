import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { api } from '../../services/api';
import { CalendarDays, Wallet, UserCheck, ArrowUpRight } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, school } = useAppStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      api.get('/api/settings/dashboard-stats')
        .then(data => {
          setStats(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [user]);

  if (!user) return null;
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-500 font-bold text-sm">
        Loading real-time dashboard analytics...
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString('en-IN', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const schoolFullName = `${school?.name || 'Shantiniketan Public School'}${school?.city ? `, ${school.city}` : ''}`;
  const bannerText = `★ ${schoolFullName} ★ ${schoolFullName} ★ ${schoolFullName} ★ ${schoolFullName} ★ ${schoolFullName} ★`;

  return (
    <div className="space-y-6">
      {/* Scrolling School Name Banner */}
      <div className="relative overflow-hidden bg-slate-900 text-amber-400 py-3 px-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg select-none">
        <div className="whitespace-nowrap animate-marquee flex gap-8">
          <span>{bannerText}</span>
          <span>{bannerText}</span>
        </div>
        <style>{`
          @keyframes marquee {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
          }
          .animate-marquee {
            display: inline-flex;
            animation: marquee 25s linear infinite;
            width: max-content;
          }
        `}</style>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Welcome & Illustration Column */}
        <div className="lg:col-span-7 card bg-white flex flex-col md:flex-row items-center justify-between gap-6 p-6 shadow-sm relative overflow-hidden min-h-[300px]">
          <div className="space-y-4 max-w-md">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-orange-50 text-brand-orange-700 rounded-full text-[10px] font-bold border border-brand-orange-100 uppercase tracking-wider">
              Academic Session 2026-27
            </span>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight leading-snug">
              Namaste, {user.name} 👋
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Welcome back to your workspace. Here is a brief snapshot of Shantiniketan Public School's key metrics for today, <strong>{todayStr}</strong>.
            </p>
            <div className="text-[11px] text-slate-400">
              Board Affiliation: MPBSE-AFF-330129 | DISE Code: 23260100101
            </div>
          </div>
          <div className="w-56 h-56 flex items-center justify-center shrink-0">
            <img 
              src="/school_pupils.png" 
              alt="School Boy and Girl" 
              className="max-w-full max-h-full object-contain hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>

        {/* Right Dashboard Stats Metrics */}
        <div className="lg:col-span-5 flex flex-col gap-6 justify-center">
          {/* Today's Attendance Metric Card */}
          <div className="card border-l-4 border-l-brand-orange-500 bg-white p-6 shadow-sm flex flex-col justify-between h-fit hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Today's Attendance</p>
                <h3 className="text-3xl font-black text-slate-800 mt-1">
                  {stats?.studentPresencePercent || 0}%
                </h3>
              </div>
              <div className="w-12 h-12 bg-brand-orange-50 rounded-2xl flex items-center justify-center text-brand-orange-600 shadow-sm shadow-brand-orange-50">
                <UserCheck size={24} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold mt-4 border-t pt-3">
              <CalendarDays size={14} className="text-slate-400" />
              <span>Today: <strong className="text-slate-700">{stats?.presenceSummary?.present || 0}</strong> Present, <strong className="text-slate-700">{stats?.presenceSummary?.absent || 0}</strong> Absent</span>
            </div>
          </div>

          {/* Today's Fees Collected Metric Card */}
          <div className="card border-l-4 border-l-brand-green-600 bg-white p-6 shadow-sm flex flex-col justify-between h-fit hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Today's Fees Collected</p>
                <h3 className="text-3xl font-black text-slate-800 mt-1">
                  {stats?.feeCollectedToday || '₹0'}
                </h3>
              </div>
              <div className="w-12 h-12 bg-brand-green-50 rounded-2xl flex items-center justify-center text-brand-green-600 shadow-sm shadow-brand-green-50">
                <Wallet size={24} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-brand-green-600 font-semibold mt-4 border-t pt-3">
              <ArrowUpRight size={14} />
              <span>Collected in active session today</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
