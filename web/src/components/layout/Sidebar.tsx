import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Home,
  PlusCircle,
  BookOpen,
  BarChart3,
  Settings,
  GraduationCap,
  FileText,
  UserCheck,
  ChevronRight,
} from 'lucide-react';
import { useRole } from '../../context/RoleContext';

export const Sidebar: React.FC = () => {
  const { role, setRole, studentName } = useRole();
  const navigate = useNavigate();

  const teacherLinks = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/create', label: 'Create Learning Unit', icon: PlusCircle },
    { to: '/units', label: 'My Units', icon: BookOpen },
    { to: '/analytics', label: 'Student Analytics', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const studentLinks = [
    { to: '/student', label: 'My Learning', icon: BookOpen, end: true },
    { to: '/student/progress', label: 'My Progress', icon: BarChart3 },
    { to: '/student/notes', label: 'Notes', icon: FileText },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const currentLinks = role === 'teacher' ? teacherLinks : studentLinks;

  const handleRoleToggle = () => {
    const nextRole = role === 'teacher' ? 'student' : 'teacher';
    setRole(nextRole);
    if (nextRole === 'teacher') {
      navigate('/');
    } else {
      navigate('/student');
    }
  };

  return (
    <aside className="w-64 bg-[#0B1437] text-white flex flex-col min-h-screen shrink-0 border-r border-[#1A234A] select-none">
      {/* Brand Header */}
      <div className="p-6 pb-5 flex items-center gap-3 border-b border-[#1A234A]/80">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center shadow-md shadow-indigo-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-lg tracking-tight text-white">LearnAI</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Studio
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Evidence-Locked GenAI</p>
        </div>
      </div>

      {/* Role Indicator Banner */}
      <div className="px-4 py-3 bg-[#111C44]/90 mx-3 my-3 rounded-xl border border-[#1A234A] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              role === 'teacher' ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400'
            }`}
          />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Active View
            </div>
            <div className="text-xs font-medium text-slate-200">
              {role === 'teacher' ? 'Teacher Mode' : `Student: ${studentName}`}
            </div>
          </div>
        </div>
        <button
          onClick={handleRoleToggle}
          className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800/60 transition-colors"
          title="Switch Role"
        >
          Switch
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-2 space-y-1">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400/80">
          {role === 'teacher' ? 'Teacher Workspace' : 'Student Portal'}
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

      {/* Bottom Footer Info */}
      <div className="p-4 border-t border-[#1A234A] text-[11px] text-slate-400 bg-[#0B1437]">
        <div className="flex items-center gap-2 mb-2 text-slate-300">
          <GraduationCap className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-xs text-white">Non-Negotiable Rule</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-snug">
          Source text is untrusted data. Every generated sentence carries verifiable evidence.
        </p>
      </div>
    </aside>
  );
};
