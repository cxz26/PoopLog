import React from 'react';
import { cn } from '@/src/core/utils/cn';

interface AppScaffoldProps {
  title?: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  floatingButton?: React.ReactNode;
  bottomNavigation?: React.ReactNode;
  className?: string;
}

export const AppScaffold: React.FC<AppScaffoldProps> = ({
  title,
  children,
  headerActions,
  floatingButton,
  bottomNavigation,
  className
}) => {
  return (
    <div className="flex flex-col h-full bg-background w-full relative overflow-hidden">
      {/* Header */}
      {title && (
        <header className="px-6 md:px-10 pt-4 md:pt-10 pb-2 md:pb-12 flex items-start justify-between bg-background z-10 sticky top-0 w-full max-w-7xl mx-auto">
          <div>
            <h1 className="text-3xl md:text-[42px] font-bold text-text-main tracking-tight m-0 leading-none">{title}</h1>
          </div>
          {headerActions && <div className="ml-4">{headerActions}</div>}
        </header>
      )}

      {/* Scrollable Body */}
      <main className={cn("flex-1 overflow-y-auto px-4 md:px-10 pb-24 md:pb-12 flex flex-col w-full max-w-7xl mx-auto", className)}>
        {children}
      </main>

      {/* Floating Action Button */}
      {floatingButton && (
        <div className="absolute bottom-24 right-6 md:right-10 z-20">
          {floatingButton}
        </div>
      )}

      {/* Bottom Navigation */}
      {bottomNavigation && (
        <div className="absolute bottom-0 left-0 right-0 z-30 md:hidden">
          {bottomNavigation}
        </div>
      )}
    </div>
  );
};
