import React from 'react';
import { useAppStore } from './store/appStore';
import { Topbar } from './components/layout/Topbar';
import { Toast } from './components/layout/Toast';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/dashboard/Dashboard';
import { Students } from './pages/students/Students';
import { Staff } from './pages/staff/Staff';
import { Attendance } from './pages/attendance/Attendance';
import { Academics } from './pages/academics/Academics';
import { Fees } from './pages/fees/Fees';
import { Documents } from './pages/documents/Documents';

// Circular & Homework stubs
const DummyHomework: React.FC = () => (
  <div className="card space-y-4">
    <h2 className="font-bold text-slate-800">Homework Assignments</h2>
    <p className="text-xs text-slate-500">Teachers can assign class tasks, attach worksheets, and grade student submissions.</p>
  </div>
);

const DummyCirculars: React.FC = () => (
  <div className="card space-y-4">
    <h2 className="font-bold text-slate-800">Circulars & Communication Inbox</h2>
    <p className="text-xs text-slate-500">Publish school circulars, notices, dates schedules, or send custom SMS messages via MSG91 sender code.</p>
  </div>
);

export const App: React.FC = () => {
  const { token, user, currentView } = useAppStore();

  // If no auth session exists, force user to login
  if (!token || !user) {
    return (
      <>
        <Login />
        <Toast />
      </>
    );
  }

  // Routing Switcher
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'students':
        return <Students />;
      case 'staff':
        return <Staff />;
      case 'attendance':
        return <Attendance />;
      case 'academics':
        return <Academics />;
      case 'fees':
        return <Fees />;
      case 'documents':
        return <Documents />;
      case 'homework':
        return <DummyHomework />;
      case 'circulars':
        return <DummyCirculars />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col bg-slate-50 min-h-screen">
      <Topbar />
      
      {/* Main scrollable body */}
      <main className="flex-1 p-3 md:p-4 overflow-y-auto w-full">
        <div className="w-full">
          {renderView()}
        </div>
      </main>

      {/* Alert Toasts */}
      <Toast />
    </div>
  );
};
