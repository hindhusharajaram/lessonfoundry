import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, Clock, Sparkles } from 'lucide-react';
import { AssetStatus } from '../../types';

interface StatusPillProps {
  status: AssetStatus | 'queued' | 'generating' | 'done' | 'published';
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, label, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  switch (status) {
    case 'approved':
    case 'done':
    case 'published':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          {label || (status === 'approved' ? 'Approved' : status === 'published' ? 'Published' : 'Done')}
        </span>
      );

    case 'needs_revision':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses}`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          {label || 'Needs Revision'}
        </span>
      );

    case 'generation_failed':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200 ${sizeClasses}`}
        >
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          {label || 'Failed'}
        </span>
      );

    case 'generating':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse ${sizeClasses}`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
          {label || 'Generating...'}
        </span>
      );

    case 'queued':
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses}`}
        >
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          {label || 'Queued'}
        </span>
      );

    case 'draft':
    default:
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          {label || 'Draft'}
        </span>
      );
  }
};
