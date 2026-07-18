import React from 'react';
import { cn } from '@/src/core/utils/cn';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  label: string;
}

export const Chip: React.FC<ChipProps> = ({ selected, label, className, ...props }) => {
  return (
    <button
      className={cn(
        "inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        selected
          ? "bg-primary text-white border-primary"
          : "bg-surface text-text-main border-border-main hover:border-primary/50",
        className
      )}
      {...props}
    >
      {label}
    </button>
  );
};
