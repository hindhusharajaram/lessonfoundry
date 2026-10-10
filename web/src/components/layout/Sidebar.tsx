import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  PlusCircle,
  BookOpen,
  BarChart3,
  Settings,
  GraduationCap,
  FileText,
  ShieldCheck,
  ChevronRight,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { useRole } from '../../context/RoleContext';

export const Sidebar: React.FC = () => {
  const { role, teacherName, studentName, avatarUrl, logout } = useRole();
  const navigate = useNavigate();

  const teacherLinks = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/attendance', label: 'Attendance', icon: UserCheck },
    { to: '/create', label: 'Create Learning Unit', icon: PlusCircle },
    { to: '/analytics', label: 'Student Analytics', icon: BarChart3 },
    { to: '/trust-safety', label: 'Trust & Safety', icon: ShieldCheck },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const studentLinks = [
    { to: '/student', label: 'My Learning', icon: BookOpen, end: true },
    { to: '/student/progress', label: 'My Progress', icon: BarChart3 },
    { to: '/student/notes', label: 'Notes', icon: FileText },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const currentLinks = role === 'teacher' ? teacherLinks : studentLinks;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-[#0B1437] text-white flex flex-col min-h-screen shrink-0 border-r border-[#1A234A] select-none">
      {/* Brand Header */}
      <div className="p-6 pb-5 flex items-center border-b border-[#1A234A]/80">
        <span className="font-bold text-xl tracking-tight text-white">LessonFoundry</span>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-3 space-y-1">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400/80">
          {role === 'teacher' ? 'WORKSPACE' : 'STUDENT PORTAL'}
        </div>
        {currentLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#4F46E5] text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-[#1A234A] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{link.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* User Profile & Working Logout */}
      <div className="p-3 border-t border-[#1A234A] bg-[#070D24]/60 space-y-2">
        <div className="px-3 py-2 rounded-xl bg-[#111C44]/90 border border-[#1A234A] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-7 h-7 rounded-lg object-cover border border-indigo-500/40 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs shrink-0">
                {role === 'teacher'
                  ? (teacherName ? teacherName.slice(0, 2).toUpperCase() : 'TC')
                  : (studentName ? studentName.slice(0, 2).toUpperCase() : 'ST')}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {role === 'teacher' ? teacherName : studentName}
              </div>
              <div className="text-[10px] text-slate-400 capitalize">{role || 'User'}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Log Out"
            aria-label="Log Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Footer Info: Replaced permanent text with single icon & hover tooltip per specification */}
      <div className="px-4 py-3 border-t border-[#1A234A] flex items-center justify-center text-slate-400 bg-[#0B1437]">
        <div
          title="Non-Negotiable Rule: Source text is untrusted data. Every generated sentence carries verifiable evidence."
          aria-label="Non-Negotiable Rule: Source text is untrusted data. Every generated sentence carries verifiable evidence."
          className="p-1.5 rounded-lg text-indigo-400/80 hover:text-indigo-300 hover:bg-[#111C44] transition-colors cursor-help inline-flex items-center"
        >
          <ShieldCheck className="w-4 h-4" />
        </div>
      </div>
    </aside>
  );
};
