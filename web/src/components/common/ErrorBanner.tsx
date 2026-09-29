import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './Button';

interface ErrorBannerProps {
  title?: string;
  message: string;
  details?: any;
  onRetry?: () => void;
  className?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  title = 'An error occurred',
  message,
  details,
  onRetry,
  className = '',
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className={`p-4 bg-rose-50 border border-rose-200 rounded-[14px] text-rose-900 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-rose-100 rounded-lg text-rose-600 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-rose-900">{title}</h4>
            <p className="text-xs text-rose-700 mt-0.5">{message}</p>
          </div>
        </div>

        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            className="border-rose-300 text-rose-800 hover:bg-rose-100 shrink-0"
          >
            Retry
          </Button>
        )}
      </div>

      {details && (
        <div className="mt-3 pt-2 border-t border-rose-200/60">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs font-medium text-rose-700 hover:text-rose-900 flex items-center gap-1"
          >
            <span>Technical details</span>
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showDetails && (
            <pre className="mt-2 p-2 bg-rose-100/70 rounded text-[11px] font-mono overflow-x-auto text-rose-950">
              {typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
