import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { api } from '../services/api';
import { KeyRound, Smartphone, Loader2, GraduationCap, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { setAuth, showToast } = useAppStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

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
    <div className="min-h-screen flex flex-col justify-center items-center px-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)',
      }}
    >
      {/* Animated gradient orbs */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, #f97316 0%, transparent 70%)',
          animation: 'pulse 4s ease-in-out infinite',
        }}
      />
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, #16a34a 0%, transparent 70%)',
          animation: 'pulse 5s ease-in-out infinite reverse',
        }}
      />
      <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full opacity-10"
        style={{
          background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
          animation: 'pulse 6s ease-in-out infinite',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Top tricolor accent line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-orange-500 via-white to-brand-green-600" />

      {/* Main Card */}
      <div
        className="w-full max-w-[420px] relative"
        style={{
          animation: 'fadeInUp 0.6s ease-out',
        }}
      >
        {/* Glassmorphism Card */}
        <div className="rounded-3xl p-8 relative overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* School Identity */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 relative"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                boxShadow: '0 8px 32px rgba(249, 115, 22, 0.35)',
              }}
            >
              <GraduationCap size={30} className="text-white" />
              {/* Glow ring */}
              <div className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  filter: 'blur(16px)',
                  opacity: 0.4,
                  zIndex: -1,
                }}
              />
            </div>

            <h1 className="text-xl font-extrabold text-white text-center leading-tight tracking-tight">
              Shantiniketan Public School
            </h1>
            <p className="text-xs text-slate-400 tracking-[0.2em] uppercase mt-2 font-medium">
              Chapetla, Madhya Pradesh
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-slate-600" />
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Secure Login</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-slate-600" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative">
                <span className={`absolute inset-y-0 left-0 pl-3.5 flex items-center transition-colors duration-200 ${focused === 'user' ? 'text-brand-orange-400' : 'text-slate-500'}`}>
                  <Smartphone size={16} />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocused('user')}
                  onBlur={() => setFocused(null)}
                  placeholder="Enter your username"
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-500 transition-all duration-200 focus:outline-none"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: focused === 'user' ? '1px solid rgba(249, 115, 22, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: focused === 'user' ? '0 0 20px rgba(249, 115, 22, 0.1)' : 'none',
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <span className={`absolute inset-y-0 left-0 pl-3.5 flex items-center transition-colors duration-200 ${focused === 'pass' ? 'text-brand-orange-400' : 'text-slate-500'}`}>
                  <KeyRound size={16} />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused(null)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-500 transition-all duration-200 focus:outline-none"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: focused === 'pass' ? '1px solid rgba(249, 115, 22, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: focused === 'pass' ? '0 0 20px rgba(249, 115, 22, 0.1)' : 'none',
                  }}
                />
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 text-white text-sm font-bold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                boxShadow: '0 8px 32px rgba(249, 115, 22, 0.3)',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.target as HTMLElement).style.boxShadow = '0 12px 40px rgba(249, 115, 22, 0.45)';
                  (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.boxShadow = '0 8px 32px rgba(249, 115, 22, 0.3)';
                (e.target as HTMLElement).style.transform = 'translateY(0)';
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
          <div className="mt-8 pt-5 border-t border-white/5 text-center">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Having trouble logging in? Contact the school office.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom branding */}
      <p className="mt-6 text-[10px] text-slate-600 tracking-wider">
        School ERP Management System
      </p>

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.1); opacity: 0.25; }
        }
      `}</style>
    </div>
  );
};
