import React from 'react';
import { useAppStore } from '../../store/appStore';
import { 
  LayoutDashboard, Users, UserCog, CalendarCheck, BookOpen, 
  FileText, IndianRupee, LogOut, HelpCircle, Bell, Award, BookCheck
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, school, currentView, setView, logout } = useAppStore();

  if (!user) return null;

  const role = user.role;

  // Sidebar mapping based on roles
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'ACCOUNTANT'] },
    { id: 'students', label: 'Students', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL'] },
    { id: 'staff', label: 'Staff HR', icon: UserCog, roles: ['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL'] },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'CLASS_TEACHER', 'SUBJECT_TEACHER'] },
    { id: 'academics', label: 'Academics', icon: BookOpen, roles: ['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'CLASS_TEACHER', 'SUBJECT_TEACHER'] },
    { id: 'fees', label: 'Fees Collection', icon: IndianRupee, roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL'] },
    { id: 'documents', label: 'TC & Certificates', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL'] },
    { id: 'homework', label: 'Homework', icon: BookCheck, roles: ['SUPER_ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'] },
    { id: 'circulars', label: 'Circulars', icon: Bell, roles: ['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL'] },
    
    // Parent/Student portal views
    { id: 'parent-home', label: 'My Portal', icon: LayoutDashboard, roles: ['PARENT', 'STUDENT'] },
    { id: 'parent-attendance', label: 'My Attendance', icon: CalendarCheck, roles: ['PARENT', 'STUDENT'] },
    { id: 'parent-marks', label: 'Report Cards', icon: Award, roles: ['PARENT', 'STUDENT'] },
    { id: 'parent-fees', label: 'Fees Dues', icon: IndianRupee, roles: ['PARENT', 'STUDENT'] },
    { id: 'parent-homework', label: 'Homework tasks', icon: BookCheck, roles: ['PARENT', 'STUDENT'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(role));

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen flex flex-col justify-between sticky top-0 no-print">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-orange-600 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-md shadow-brand-orange-200">
            S
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-800 leading-tight">Shantiniketan</h1>
            <p className="text-[10px] text-brand-green-600 font-semibold tracking-wider uppercase">Public School</p>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-4 bg-gradient-to-br from-brand-orange-50 to-orange-100/30 rounded-xl border border-brand-orange-100/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-orange-200 flex items-center justify-center text-brand-orange-800 font-bold text-sm">
              {(user?.name || 'User').charAt(0)}
            </div>
            <div className="overflow-hidden">
              <h4 className="font-bold text-xs text-slate-700 truncate">{user?.name || 'School User'}</h4>
              <p className="text-[10px] text-brand-orange-700 font-semibold uppercase">{(user?.role || 'Guest').replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="px-3 space-y-1">
          {filteredMenu.map(item => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  active 
                    ? 'bg-brand-orange-600 text-white shadow-md shadow-brand-orange-100' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={16} className={active ? 'text-white' : 'text-slate-400'} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
};
