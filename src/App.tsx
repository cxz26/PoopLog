/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RouterProvider } from 'react-router-dom';
import { router } from './core/router';
import { useEffect } from 'react';
import { db } from './core/services/database';
import { useSettingsStore } from './core/stores/useSettingsStore';
import { useSecurityStore } from './core/stores/useSecurityStore';
import { useCloudStore } from './core/stores/useCloudStore';
import { LockScreen } from './features/security/LockScreen';
import { PWAUpdater } from './shared/components/PWAUpdater';

export default function App() {
  const { theme } = useSettingsStore();
  const { pinHash, requireAuthOnLaunch, isAuthenticated, lockApp } = useSecurityStore();

  useEffect(() => {
    // Initialize required services on app start
    db.initialize().catch(console.error);
    useCloudStore.getState().initialize().catch(console.error);
    
    if (requireAuthOnLaunch) {
      lockApp();
    }
  }, [requireAuthOnLaunch, lockApp]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const showLockScreen = pinHash && requireAuthOnLaunch && !isAuthenticated;

  return (
    <>
      <RouterProvider router={router} />
      {showLockScreen && <LockScreen />}
      <PWAUpdater />
    </>
  );
}
