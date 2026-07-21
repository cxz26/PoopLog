import React, { Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/src/shared/components/AppLayout';
import { APP_CONSTANTS } from '@/src/core/constants';
import { EmptyState } from '@/src/shared/components/EmptyState';
import { SectionCard } from '@/src/shared/components/SectionCard';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/src/shared/components/Button';
import { Link } from 'react-router-dom';

const DashboardPage = React.lazy(() => import('@/src/features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const HistoryPage = React.lazy(() => import('@/src/features/history/HistoryPage').then(m => ({ default: m.HistoryPage })));
const StatisticsPage = React.lazy(() => import('@/src/features/statistics/StatisticsPage').then(m => ({ default: m.StatisticsPage })));
const SettingsPage = React.lazy(() => import('@/src/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const CustomTagsPage = React.lazy(() => import('@/src/features/settings/CustomTagsPage').then(m => ({ default: m.CustomTagsPage })));
const NewLogFlow = React.lazy(() => import('@/src/features/log/NewLogFlow').then(m => ({ default: m.NewLogFlow })));
const LogDetailPage = React.lazy(() => import('@/src/features/log/LogDetailPage').then(m => ({ default: m.LogDetailPage })));

const SuspenseWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
    {children}
  </Suspense>
);

const NotFoundPage = () => (
  <div className="flex flex-col h-screen bg-background w-full max-w-md mx-auto items-center justify-center p-6 sm:border sm:border-border-main shadow-xl">
    <SectionCard className="w-full text-center">
      <EmptyState 
        icon={<FileQuestion size={48} />}
        title="Page Not Found"
        description="The route you requested does not exist."
        action={
          <Link to={APP_CONSTANTS.ROUTES.HOME}>
            <Button>Go to Dashboard</Button>
          </Link>
        }
      />
    </SectionCard>
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        path: APP_CONSTANTS.ROUTES.HOME,
        element: <SuspenseWrapper><DashboardPage /></SuspenseWrapper>,
      },
      {
        path: APP_CONSTANTS.ROUTES.HISTORY,
        element: <SuspenseWrapper><HistoryPage /></SuspenseWrapper>,
      },
      {
        path: APP_CONSTANTS.ROUTES.STATISTICS,
        element: <SuspenseWrapper><StatisticsPage /></SuspenseWrapper>,
      },
      {
        path: APP_CONSTANTS.ROUTES.SETTINGS,
        element: <SuspenseWrapper><SettingsPage /></SuspenseWrapper>,
      },
    ],
  },
  {
    path: APP_CONSTANTS.ROUTES.LOG_NEW,
    element: <SuspenseWrapper><NewLogFlow /></SuspenseWrapper>
  },
  {
    path: '/settings/tags',
    element: <SuspenseWrapper><CustomTagsPage /></SuspenseWrapper>
  },
  {
    path: '/log/:id',
    element: <SuspenseWrapper><LogDetailPage /></SuspenseWrapper>
  },
  {
    path: '/log/:id/edit',
    element: <SuspenseWrapper><NewLogFlow /></SuspenseWrapper>
  }
]);
