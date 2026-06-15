import React, { useEffect, useState } from 'react';
import { useAppStore, AcademicYear } from '../../store/appStore';
import { api } from '../../services/api';
import { 
  Calendar, User, ChevronDown, LogOut, LayoutDashboard, 
  Users, UserCog, CalendarCheck, BookOpen, IndianRupee, 
  FileText, BookCheck, Bell, Award 
} from 'lucide-react';

export const Topbar: React.FC = () => {
  const { school, activeYear, academicYears, setAcademicYears, switchAcademicYear, user, currentView, setView, logout } = useAppStore();
  const [openYears, setOpenYears] = useState(false);

  useEffect(() => {
    if (user) {
      api.get('/api/settings/academic-years')
        .then((data) => {
          setAcademicYears(data);
        })
        .catch((err) => console.error('Failed to load academic years:', err));
    }
  }, [user]);

  if (!user) return null;

  const role = user.role;

  // Horizontal Menu items based on roles
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
    <header className="bg-white border-b border-slate-200 z-10 sticky top-0 no-print flex flex-col">
      {/* Row 1: Brand & Actions */}
      <div className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-100">
        {/* Brand/School Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-orange-600 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-md shadow-brand-orange-100">
            S
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-slate-800 leading-tight">
              {school?.name || 'Shantiniketan Public School'}
            </h1>
            <p className="text-[10px] text-brand-green-600 font-bold uppercase tracking-wider">
              {school?.city || 'Chapetla'}
            </p>
          </div>
        </div>

        {/* Right Switcher / Profile / Logout */}
        <div className="flex items-center gap-6">
          {/* Session Switcher */}
          <div className="relative">
            <button
              onClick={() => setOpenYears(!openYears)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Calendar size={13} className="text-brand-orange-500" />
              Session: {activeYear ? activeYear.name : 'Choose...'}
              <ChevronDown size={13} className="text-slate-400" />
            </button>

            {openYears && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Switch Academic Year</div>
                {academicYears.map((year: AcademicYear) => (
                  <button
                    key={year.id}
                    onClick={() => {
                      switchAcademicYear(year);
                      setOpenYears(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 flex justify-between items-center ${
                      activeYear?.id === year.id ? 'text-brand-orange-600' : 'text-slate-700'
                    }`}
                  >
                    {year.name}
                    {year.isCurrent && (
                      <span className="text-[9px] bg-brand-green-50 text-brand-green-700 px-1.5 py-0.5 rounded-full font-bold">Active</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User profile capsule */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="font-bold text-xs text-slate-800 leading-tight">{user?.name}</div>
              <div className="text-[10px] text-brand-orange-700 uppercase font-semibold">{(user?.role || 'GUEST').replace('_', ' ')}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-brand-orange-50 flex items-center justify-center border border-brand-orange-200 text-brand-orange-800 font-bold text-xs">
              {(user?.name || 'U').charAt(0)}
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={logout}
            title="Sign Out"
            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Row 2: Horizontal Scrollable Menu */}
      <div className="bg-slate-50/50 px-4 md:px-6 py-1.5 flex items-center gap-1.5 overflow-x-auto shadow-inner border-b border-slate-100">
        {filteredMenu.map(item => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all shrink-0 ${
                active 
                  ? 'bg-brand-orange-600 text-white shadow shadow-brand-orange-200' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon size={14} className={active ? 'text-white' : 'text-slate-400'} />
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
