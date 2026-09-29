import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      id="theme-toggle-button"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative w-8 h-8 rounded-xl flex items-center justify-center border border-slate-200/90 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all duration-200 cursor-pointer overflow-hidden shadow-2xs ${className}`}
    >
      {/* Sun Icon for Light Mode */}
      <div
        className={`transition-all duration-300 transform flex items-center justify-center ${
          theme === 'dark'
            ? 'rotate-90 scale-0 opacity-0 absolute'
            : 'rotate-0 scale-100 opacity-100'
        }`}
      >
        <Sun className="w-4 h-4 text-amber-500" />
      </div>

      {/* Moon Icon for Dark Mode */}
      <div
        className={`transition-all duration-300 transform flex items-center justify-center ${
          theme === 'dark'
            ? 'rotate-0 scale-100 opacity-100'
            : '-rotate-90 scale-0 opacity-0 absolute'
        }`}
      >
        <Moon className="w-4 h-4 text-indigo-300" />
      </div>
    </button>
  );
};
