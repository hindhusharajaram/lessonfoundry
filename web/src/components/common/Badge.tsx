import React from 'react';
import { BloomLevel } from '../../types';

interface BadgeProps {
  bloom?: BloomLevel | string;
  label?: string;
  variant?: 'bloom' | 'info' | 'neutral' | 'success' | 'warning' | 'danger';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ bloom, label, variant = 'neutral', className = '' }) => {
  if (bloom) {
    const b = bloom.toLowerCase();
    let bg = 'bg-slate-100 text-slate-700 border-slate-200';
    let text = bloom.charAt(0).toUpperCase() + bloom.slice(1);

    if (b.includes('remember')) {
      bg = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (b.includes('understand')) {
      bg = 'bg-cyan-50 text-cyan-700 border-cyan-200';
    } else if (b.includes('apply')) {
      bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (b.includes('analyze')) {
      bg = 'bg-purple-50 text-purple-700 border-purple-200';
    } else if (b.includes('evaluate')) {
      bg = 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
    } else if (b.includes('create')) {
      bg = 'bg-amber-50 text-amber-700 border-amber-200';
    }

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${bg} ${className}`}
      >
        Bloom: {text}
      </span>
    );
  }

  const variantMap = {
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    bloom: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variantMap[variant]} ${className}`}
    >
      {label}
    </span>
  );
};
