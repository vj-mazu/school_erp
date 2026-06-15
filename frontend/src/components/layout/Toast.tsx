import React from 'react';
import { useAppStore } from '../../store/appStore';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast, hideToast } = useAppStore();

  if (!toast.visible) return null;

  const icons = {
    success: <CheckCircle2 className="text-brand-green-600" size={18} />,
    error: <AlertCircle className="text-rose-600" size={18} />,
    info: <Info className="text-brand-orange-500" size={18} />
  };

  const bgClasses = {
    success: 'bg-white border-l-4 border-l-brand-green-600 shadow-lg',
    error: 'bg-white border-l-4 border-l-rose-600 shadow-lg',
    info: 'bg-white border-l-4 border-l-brand-orange-500 shadow-lg'
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-100 max-w-sm transition-all duration-300 animate-slide-in no-print bg-white shadow-xl">
      <div className={`flex items-center gap-3 ${bgClasses[toast.type]} p-1 rounded w-full`}>
        {icons[toast.type]}
        <p className="text-xs font-bold text-slate-700">{toast.message}</p>
        <button 
          onClick={hideToast} 
          className="text-slate-400 hover:text-slate-600 text-xs font-bold ml-auto pl-2"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
