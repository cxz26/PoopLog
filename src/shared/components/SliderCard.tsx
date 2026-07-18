import React from 'react';
import { cn } from '@/src/core/utils/cn';

interface SliderCardProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export const SliderCard: React.FC<SliderCardProps> = ({ label, value, onChange, min = 0, max = 10, step = 1, className }) => {
  return (
    <div className={cn("bg-surface p-6 rounded-[24px] border border-border-main", className)}>
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-lg">{label}</h4>
        <span className="text-xl font-bold text-primary">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-2 bg-border-main rounded-lg appearance-none cursor-pointer"
      />
      <div className="flex justify-between text-xs text-text-main/50 mt-2">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};
