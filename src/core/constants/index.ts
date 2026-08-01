export const APP_CONSTANTS = {
  DB_NAME: 'PoopLogDatabase',
  ANIMATION_DURATION_MS: 300,
  STORAGE_THEME_KEY: 'app_theme',
  STORAGE_FIRST_LAUNCH: 'first_launch',
  ROUTES: {
    HOME: '/',
    DASHBOARD: '/dashboard',
    HISTORY: '/history',
    STATISTICS: '/statistics',
    SETTINGS: '/settings',
    LOG_NEW: '/log/new',
    LOG_DETAIL: (id: number | string) => `/log/${id}`,
    LOG_EDIT: (id: number | string) => `/log/${id}/edit`,
  }
};

export const SPACING = {
  S8: '8px',
  S16: '16px',
  S24: '24px',
  S32: '32px',
  S40: '40px',
  S48: '48px',
};
