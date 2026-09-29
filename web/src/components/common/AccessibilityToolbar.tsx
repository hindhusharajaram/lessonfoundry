import React, { useState } from 'react';
import { Type, Eye, Sparkles, Sliders, ChevronDown } from 'lucide-react';
import { useAccessibility } from '../../context/AccessibilityContext';

export const AccessibilityToolbar: React.FC = () => {
  const { dyslexiaMode, setDyslexiaMode, highContrast, setHighContrast, textSize, setTextSize } =
    useAccessibility();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-sm"
        aria-label="Accessibility options"
        aria-expanded={isOpen}
      >
        <Sliders className="w-3.5 h-3.5 text-indigo-600" />
        <span>Accessibility</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 space-y-3 z-50 animate-in text-xs">
          <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
            <span>Inclusive Learning Tools</span>
            <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
              WCAG AAA
            </span>
          </div>

          {/* Dyslexia Mode Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800 block">Dyslexia-Friendly Mode</span>
              <span className="text-[10px] text-slate-400">Atkinson Hyperlegible font</span>
            </div>
            <input
              type="checkbox"
              checked={dyslexiaMode}
              onChange={(e) => setDyslexiaMode(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* High Contrast Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800 block">High Contrast</span>
              <span className="text-[10px] text-slate-400">Deep borders & contrast</span>
            </div>
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* Text Size Controls */}
          <div className="space-y-1.5 pt-1">
            <span className="font-semibold text-slate-800 block">Reading Text Size:</span>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setTextSize('normal')}
                className={`py-1 rounded text-xs font-semibold ${
                  textSize === 'normal' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setTextSize('lg')}
                className={`py-1 rounded text-xs font-semibold ${
                  textSize === 'lg' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                Large
              </button>
              <button
                type="button"
                onClick={() => setTextSize('xl')}
                className={`py-1 rounded text-xs font-semibold ${
                  textSize === 'xl' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                Extra Large
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
