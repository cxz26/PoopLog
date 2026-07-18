import React from 'react';
import { cn } from '@/src/core/utils/cn';

interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export const SectionCard = React.forwardRef<HTMLDivElement, SectionCardProps>(
  ({ className, title, children, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn("bg-surface rounded-[24px] p-8 md:p-[60px] shadow-[0_4px_20px_rgba(142,125,107,0.05)] border border-border-main", className)}
        {...props}
      >
        {title && (
          <h3 className="text-lg font-semibold text-text-main mb-4">{title}</h3>
        )}
        {children}
      </div>
    );
  }
);
SectionCard.displayName = 'SectionCard';
