# PoopLog — Desktop

Local-first, offline-ready, private Windows desktop app for personal health tracking.

Phase 1: Project foundation — React + Vite + Tauri 2 + SQLite.

## Tech stack

- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS 3, Zustand
- Desktop: Tauri 2, Rust
- Database: SQLite via `tauri-plugin-sql` (local file `pooplog.db`)

## Requirements

- Node.js 20+
- Rust (stable, x86_64-pc-windows-msvc)
- Visual Studio Build Tools 2022/2026 with C++ workload (MSVC)
- WebView2 Runtime (included on Windows 11)

## Scripts

```powershell
npm run dev              # Vite dev server only (browser preview)
npm run dev:desktop      # Vite + Tauri desktop window
npm run build            # Production frontend build (dist/)
npm run build:desktop    # Tauri production bundle → NSIS installer + exe
npm run preview          # Preview built frontend
```

## Project structure

```
src/
  app/            # App shell + providers
  core/           # database, stores, types, utils
  features/       # dashboard, log, history, statistics, settings, backup (placeholders)
  shared/         # components, hooks, constants
  styles/
src-tauri/
  src/            # Rust backend
  capabilities/   # Tauri permissions
  icons/
  tauri.conf.json
```

## Database

- Location: Tauri app-data directory → `pooplog.db` (SQLite)
- Access: `src/core/database` – never call raw SQL from components
- Migrations: versioned in `src/core/database/migrations.ts`, tracked via `_migrations` table
- Phase 1 test table: `_health_check` (verifies init + write)

## Privacy

- No Supabase, Firebase, Vercel, or cloud DB
- No mandatory online account
- No telemetry on health records
- Future backups: manual encrypted export only (not yet implemented)

## Windows installer

Configured for NSIS target. After `npm run build:desktop`:

- Installer: `src-tauri/target/release/bundle/nsis/PoopLog_0.1.0_x64-setup.exe`
- Binary: `src-tauri/target/release/pooplog.exe` (or `app.exe` depending on Cargo name)

No code signing or auto-update in Phase 1.
