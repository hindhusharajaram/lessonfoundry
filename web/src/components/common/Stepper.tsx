import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: number;
  title: string;
  subtitle: string;
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
      <ol className="flex items-center justify-between gap-2 md:gap-4 overflow-x-auto py-2">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isAccessible = step.id <= maxAccessibleStep;

          return (
            <li key={step.id} className="flex-1 min-w-[140px]">
              <div
                onClick={() => {
                  if (isAccessible && onStepClick && !isCurrent) {
                    onStepClick(step.id);
                  }
                }}
                className={`group flex flex-col border-t-4 pt-3 transition-colors select-none ${
                  isAccessible && !isCurrent ? 'cursor-pointer' : 'cursor-default'
                } ${
                  isCompleted
                    ? 'border-emerald-500'
                    : isCurrent
                    ? 'border-[#4F46E5]'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-[#4F46E5] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 border border-slate-300'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.id}
                  </span>
                  <span
                    className={`text-xs font-semibold tracking-wide ${
                      isCompleted
                        ? 'text-emerald-700'
                        : isCurrent
                        ? 'text-[#4F46E5]'
                        : 'text-slate-500'
                    }`}
                  >
                    STEP {step.id}
                  </span>
                </div>
                <span
                  className={`text-sm font-medium line-clamp-1 ${
                    isCurrent ? 'text-slate-900 font-semibold' : 'text-slate-600'
                  }`}
                >
                  {step.title}
                </span>
                <span className="text-[11px] text-slate-400 line-clamp-1 hidden sm:block">
                  {step.subtitle}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
