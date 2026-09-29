import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: number;
  title: string;
  subtitle?: string;
}

interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
  maxAccessibleStep?: number;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  maxAccessibleStep = 1,
}) => {
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center justify-between gap-3 md:gap-5 overflow-x-auto py-2">
        {steps.map((step) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isAccessible = step.id <= maxAccessibleStep;

          return (
            <li key={step.id} className="flex-1 min-w-[130px]">
              <div
                title={step.subtitle}
                onClick={() => {
                  if (isAccessible && onStepClick && !isCurrent) {
                    onStepClick(step.id);
                  }
                }}
                className={`group relative flex flex-col border-t-[3px] pt-3.5 select-none transition-all duration-200 ${
                  isAccessible && !isCurrent ? 'cursor-pointer hover:border-indigo-400' : 'cursor-default'
                } ${
                  isCompleted
                    ? 'border-emerald-500'
                    : isCurrent
                    ? 'border-[#4F46E5]'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-200 ${
                      isCompleted
                        ? 'bg-emerald-500 text-white scale-100 shadow-sm'
                        : isCurrent
                        ? 'bg-[#4F46E5] text-white shadow-md shadow-indigo-500/25 scale-105 ring-4 ring-indigo-500/15'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300/80 dark:border-slate-600'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : step.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isCompleted
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : isCurrent
                        ? 'text-[#4F46E5] dark:text-indigo-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    STEP {step.id}
                  </span>
                </div>
                <span
                  className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                    isCurrent
                      ? 'text-slate-900 dark:text-white font-bold'
                      : isCompleted
                      ? 'text-slate-800 dark:text-slate-200'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {step.title}
                </span>

                {/* On-demand subtle tooltip on hover if subtitle exists */}
                {step.subtitle && (
                  <div className="absolute left-0 -top-8 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                    {step.subtitle}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
