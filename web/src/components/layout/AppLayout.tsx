import React from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useRole } from '../../context/RoleContext';
import { AccessibilityToolbar } from '../common/AccessibilityToolbar';
import { Sidebar } from './Sidebar';

export const Header: React.FC = () => {
  const { role, studentName } = useRole();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Teacher Dashboard';
    if (path === '/create') return 'Create New Learning Unit';
    if (path === '/units') return 'My Learning Units';
    if (path.startsWith('/units/')) return 'Learning Pack Review';
    if (path === '/analytics') return 'Student Performance & Analytics';
    if (path === '/settings') return 'Studio Settings';
    if (path === '/student') return 'My Learning Units';
    if (path.startsWith('/student/quiz/')) return 'Formative Assessment';
    if (path === '/student/progress') return 'My Learning Progress';
    return 'LessonFoundry Studio';
  };

  return (
    <header className="h-16 bg-white border-b border-[#E5E9F2] px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-slate-900">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center gap-4">
        <AccessibilityToolbar />

        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Evidence-Locked Engine Active</span>
        </div>

        <div className="h-4 w-px bg-slate-200" />

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-semibold text-xs shadow-sm">
            {role === 'teacher' ? 'TC' : 'ST'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-800">
              {role === 'teacher' ? 'Teacher Admin' : studentName}
            </div>
            <div className="text-[10px] text-slate-400 capitalize">{role} Role</div>
          </div>
        </div>
      </div>
    </header>
  );
};

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-[#F5F7FB]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto animate-in">{children}</main>
      </div>
    </div>
  );
};
