import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 to 100
  size?: 'sm' | 'md' | 'lg';
  color?: 'brand' | 'success' | 'amber' | 'rose';
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  size = 'md',
  color = 'brand',
  showLabel = false,
  className = '',
}) => {
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const colorClasses = {
    brand: 'bg-[#4F46E5]',
    success: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1 text-xs font-medium text-slate-600">
          <span>Progress</span>
          <span>{clampedProgress}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${heightClasses[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${colorClasses[color]}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

interface ProgressRingProps {
  score: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  score,
  size = 90,
  strokeWidth = 8,
  label = 'Pack Health',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedScore = Math.min(100, Math.max(0, Math.round(score)));
  const offset = circumference - (clampedScore / 100) * circumference;

  let strokeColor = '#16A34A'; // emerald
  if (clampedScore < 50) {
    strokeColor = '#DC2626'; // danger red
  } else if (clampedScore < 75) {
    strokeColor = '#F59E0B'; // warning amber
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            className="text-slate-100"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke={strokeColor}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-slate-800">{clampedScore}</span>
          <span className="text-[10px] text-slate-400 font-medium -mt-0.5">/ 100</span>
        </div>
      </div>
      {label && <span className="text-xs font-semibold text-slate-600 mt-2">{label}</span>}
    </div>
  );
};
