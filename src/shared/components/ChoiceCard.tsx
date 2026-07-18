import React from 'react';
import { cn } from '@/src/core/utils/cn';

interface ChoiceCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export const ChoiceCard: React.FC<ChoiceCardProps> = ({ selected, title, description, icon, className, ...props }) => {
  return (
    <button
      className={cn(
        "flex flex-col items-center justify-center p-6 rounded-[24px] border-2 transition-all w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        selected 
          ? "border-primary bg-primary/5 text-primary" 
          : "border-border-main bg-surface text-text-main hover:border-primary/30",
        className
      )}
      {...props}
    >
      {icon && <div className="mb-3">{icon}</div>}
      <h4 className="font-semibold text-lg">{title}</h4>
      {description && <p className="text-sm opacity-70 mt-1">{description}</p>}
    </button>
  );
};
