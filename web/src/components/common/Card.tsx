import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hoverable = false, ...props }) => {
  return (
    <div
      className={`bg-[var(--bg-card)] rounded-[14px] border border-[var(--border-card)] shadow-card transition-all duration-200 ${
        hoverable ? 'hover:shadow-elevated hover:border-[#4F46E5]/40' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, className = '' }) => {
  return (
    <div className={`p-5 pb-4 border-b border-[var(--border-subtle)] flex items-center justify-between ${className}`}>
      <div>
        <h3 className="font-semibold text-[var(--text-primary)] text-base flex items-center gap-2">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return <div className={`p-5 ${className}`}>{children}</div>;
};

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return <div className={`p-4 bg-[var(--bg-card-footer)] border-t border-[var(--border-subtle)] rounded-b-[14px] ${className}`}>{children}</div>;
};
