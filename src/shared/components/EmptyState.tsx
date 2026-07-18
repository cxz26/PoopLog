import React from 'react';
import { cn } from '@/src/core/utils/cn';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon, 
  title, 
  description, 
  action,
  className,
  ...props 
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center w-full max-w-[600px] mx-auto", className)} {...props}>
      <div className="inline-flex items-center px-3 py-1.5 bg-background border border-border-main rounded-full text-xs font-semibold text-primary mb-4">
        System Ready
      </div>
      {icon && (
        <div className="w-20 h-20 rounded-[20px] bg-primary/10 flex items-center justify-center mb-6 text-primary">
          {icon}
        </div>
      )}
      <h3 className="text-2xl font-semibold text-text-main mb-3">{title}</h3>
      <p className="text-base leading-[1.6] text-text-main/70 max-w-[400px] mb-8">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
