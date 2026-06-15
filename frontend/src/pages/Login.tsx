import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { api } from '../services/api';
import { KeyRound, Smartphone, Loader2, Landmark } from 'lucide-react';

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
      {/* Background Indian Tricolor Gradient Highlights */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-orange-500 via-white to-brand-green-600"></div>
      
      {/* Absolute background patterns */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-orange-100/30 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-green-100/30 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-xl p-8 relative">
        {/* School Logo Area */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-orange-200 mb-4 animate-bounce">
            <Landmark size={32} />
          </div>
          <h2 className="text-xl font-extrabold text-slate-800 text-center leading-tight">
            Shantiniketan Public School
          </h2>
          <p className="text-xs font-semibold text-brand-green-600 tracking-wider uppercase mt-1">
            ERP Portal • Chapetla
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Username (User ID)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Smartphone size={16} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. superadmin / principal / clerk"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange-500 focus:bg-white text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Access Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <KeyRound size={16} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange-500 focus:bg-white text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-orange-600 hover:bg-brand-orange-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-orange-100 hover:shadow-xl transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Authenticating...
              </>
            ) : (
              'Secure Log In'
            )}
          </button>
        </form>

        {/* Info Box */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <div className="inline-block p-1 bg-brand-green-50 rounded text-[10px] text-brand-green-700 font-bold border border-brand-green-100">
            CBSE Affiliation: CBSE-AFF-330129
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Having trouble logging in? Please contact the School Office Administrator.
          </p>
        </div>
      </div>
    </div>
  );
};
