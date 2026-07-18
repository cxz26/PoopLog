import React from 'react';
import { motion } from 'motion/react';

interface SettingsItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
}

export const SettingsItem: React.FC<SettingsItemProps> = ({ icon, title, subtitle, action, onClick, destructive }) => {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 bg-surface ${onClick ? 'hover:bg-border-main/20 active:bg-border-main/30 cursor-pointer' : ''} transition-colors`}
    >
      <div className="flex items-center gap-4">
        {icon && (
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${destructive ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
            {icon}
          </div>
        )}
        <div className="text-left">
          <div className={`font-semibold ${destructive ? 'text-danger' : 'text-text-main'}`}>{title}</div>
          {subtitle && <div className="text-sm text-text-main/60 mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </Component>
  );
};

export const SettingsGroup: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-text-main/50 uppercase tracking-widest pl-4 mb-2">{title}</h3>
      <div className="bg-surface border border-border-main rounded-3xl overflow-hidden divide-y divide-border-main shadow-sm">
        {children}
      </div>
    </div>
  );
};

export const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out ${checked ? 'bg-success' : 'bg-border-main'}`}
    >
      <motion.div
        layout
        className="bg-white w-5 h-5 rounded-full shadow-md"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
};
