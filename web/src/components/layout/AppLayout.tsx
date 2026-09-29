import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, X } from 'lucide-react';
import { useRole } from '../../context/RoleContext';
import { useSearch } from '../../context/SearchContext';
import { ThemeToggle } from '../common/ThemeToggle';
import { Sidebar } from './Sidebar';

export const Header: React.FC = () => {
  const { role, studentName, teacherName, avatarUrl } = useRole();
  const { searchQuery, setSearchQuery } = useSearch();
  const location = useLocation();
  const navigate = useNavigate();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '/units') return 'LessonFoundry';
    if (path === '/create') return 'Create New Learning Unit';
    if (path.startsWith('/units/')) return 'Learning Pack Review';
    if (path === '/trust-safety') return 'Trust, Safety & Governance';
    if (path === '/settings') return 'Account';
    if (path === '/student') return 'My Learning Units';
    if (path.startsWith('/student/quiz/')) return 'Formative Assessment';
    if (path === '/student/progress') return 'My Learning Progress';
    return 'LessonFoundry';
  };

  return (
    <header className="h-16 bg-[var(--bg-card)] border-b border-[var(--border-color)] px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs transition-colors duration-200">
      <div className="flex items-center gap-3 shrink-0">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">{getPageTitle()}</h1>
      </div>

      {/* Global Real-Time Search Bar */}
      <div className="flex-1 max-w-md mx-6 hidden sm:block">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="global-curriculum-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search units, curriculum..."
            className="w-full bg-[var(--bg-card-secondary)] border border-[var(--border-color)] rounded-xl pl-9 pr-8 py-2 text-xs text-[var(--text-primary)] placeholder-slate-400 focus:outline-none focus:border-[#4F46E5] focus:bg-[var(--bg-card)] focus:ring-2 focus:ring-[#4F46E5]/15 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
              aria-label="Clear search query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Aligned Right Controls: Theme Toggle, Notifications & Profile */}
      <div className="flex items-center gap-3 shrink-0">
        <ThemeToggle />

        <button
          type="button"
          onClick={() => navigate('/analytics')}
          title="Notifications & Analytics"
          aria-label="Notifications & Analytics"
          className="w-8 h-8 rounded-xl flex items-center justify-center border border-[var(--border-color)] bg-[var(--bg-card-secondary)] hover:bg-[var(--bg-card-footer)] text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-[var(--border-color)] hidden sm:block mx-0.5" />

        <div className="flex items-center gap-2.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover border border-indigo-200 dark:border-indigo-800 shadow-sm"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-semibold text-xs shadow-sm">
              {role === 'teacher' ? (teacherName ? teacherName.slice(0, 2).toUpperCase() : 'TC') : 'ST'}
            </div>
          )}
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[120px]">
              {role === 'teacher' ? teacherName : studentName}
            </div>
            <div className="text-[10px] text-slate-400 capitalize">{role === 'teacher' ? 'Teacher' : 'Student'}</div>
          </div>
        </div>
      </div>
    </header>
  );
};

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto animate-in">{children}</main>
      </div>
    </div>
  );
};
