import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, History, BarChart3, Settings } from 'lucide-react';
import { AppScaffold } from '@/src/shared/components/AppScaffold';
import { APP_CONSTANTS } from '@/src/core/constants';
import { cn } from '@/src/core/utils/cn';

const NavTabs = [
  { name: 'Dashboard', path: APP_CONSTANTS.ROUTES.HOME, icon: LayoutDashboard },
  { name: 'History', path: APP_CONSTANTS.ROUTES.HISTORY, icon: History },
  { name: 'Statistics', path: APP_CONSTANTS.ROUTES.STATISTICS, icon: BarChart3 },
  { name: 'Settings', path: APP_CONSTANTS.ROUTES.SETTINGS, icon: Settings },
];

const Sidebar = () => (
  <nav className="hidden md:flex flex-col w-64 bg-surface border-r border-border-main p-6 shrink-0 h-screen sticky top-0">
    <div className="mb-12 px-4">
      <h1 className="text-3xl font-black text-text-main tracking-tight m-0 leading-none">PoopLog</h1>
      <p className="text-sm text-primary/80 mt-1 font-medium">Your privacy-first tracker</p>
    </div>
    <div className="flex flex-col gap-2">
      {NavTabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-4 px-4 py-4 rounded-[20px] transition-colors cursor-pointer no-underline group",
              isActive 
                ? "bg-primary text-white" 
                : "text-text-main/70 hover:bg-surface-hover hover:text-text-main"
            )
          }
        >
          <tab.icon className={cn("w-6 h-6", "transition-colors")} strokeWidth={2} />
          <span className="text-sm font-bold uppercase tracking-wider">{tab.name}</span>
        </NavLink>
      ))}
    </div>
  </nav>
);

const BottomNav = () => (
  <nav className="md:hidden h-[88px] bg-surface border-t border-border-main flex items-center justify-around px-6 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
    {NavTabs.map((tab) => (
      <NavLink
        key={tab.path}
        to={tab.path}
        className={({ isActive }) =>
          cn(
            "flex flex-col items-center gap-1.5 p-2 min-w-[64px] transition-colors cursor-pointer no-underline",
            isActive 
              ? "text-primary" 
              : "text-text-main/40 hover:text-text-main"
          )
        }
      >
        <tab.icon className="w-6 h-6" strokeWidth={2} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.02em]">{tab.name}</span>
      </NavLink>
    ))}
  </nav>
);

export const AppLayout: React.FC = () => {
  const location = useLocation();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case APP_CONSTANTS.ROUTES.HOME:
        return 'Dashboard';
      case APP_CONSTANTS.ROUTES.HISTORY:
        return 'History';
      case APP_CONSTANTS.ROUTES.STATISTICS:
        return 'Statistics';
      case APP_CONSTANTS.ROUTES.SETTINGS:
        return 'Settings';
      default:
        return 'PoopLog';
    }
  };

  return (
    <div className="flex w-full h-screen bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 overflow-hidden">
        <AppScaffold 
          title={getPageTitle()}
          bottomNavigation={<BottomNav />}
        >
          <Outlet />
        </AppScaffold>
      </div>
    </div>
  );
};
