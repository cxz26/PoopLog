# PoopLog — Desktop

Local-first, offline-ready, private Windows desktop app for personal health tracking.

**Status: Private Beta** — the application has passed a private beta release candidate audit and is in active internal testing.

## Tech stack

- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS 3, Zustand
- Desktop: Tauri 2, Rust
- Database: SQLite via `tauri-plugin-sql` (local file `pooplog.db`)

## Features

- Dashboard with daily check-in and weekly summary
- Bowel movement logging: multiple records per day, exact or approximate time, Bristol 1–7 scale, amount, difficulty, and pain
- Associated tracking: symptoms, food, medication, exercise, sleep, water, notes, and "no bowel movement" days
- History with edit and delete (with confirmation)
- Statistics with time-range filtering
- PIN protection: setup, app lock, manual lock, change, and disable
- Encrypted `.plog` backup and restore (replace-only restore)
- Automatic encrypted safety backup with atomic restore
- Fully responsive with accessibility QA

## Privacy

- Local-first: all data stays on your machine
- Completely offline operation — no internet connection required
- SQLite local storage only; no Supabase, Firebase, or cloud backend
- No mandatory account, no telemetry on health records
- PIN protection: PBKDF2-SHA-256 with a random salt; the plaintext PIN is never stored
- Backups: AES-256-GCM encrypted `.plog` files (PBKDF2-SHA-256, 250,000 iterations, random 16-byte salt, random 12-byte nonce, canonical header as AAD); the backup password is never stored
- Note: the SQLite database file itself is not encrypted — encryption applies to backups

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
npm run verify:schema    # Verify local database schema
```

## Project structure

```
src/
  app/            # App shell + providers
  core/           # backup, database, security, services, stores, types, utils
  features/       # dashboard, log, history, statistics, settings, security, backup
  shared/         # components, hooks, constants
  styles/
src-tauri/
  src/            # Rust backend
  capabilities/   # Tauri permissions
  icons/
  tauri.conf.json
scripts/          # QA and test scripts
```

## Database

- Location: Tauri app-data directory → `pooplog.db` (SQLite)
- Access: `src/core/database` – never call raw SQL from components
- Migrations: versioned in `src/core/database/migrations.ts`, tracked via `_migrations` table
- Main tables: `daily_checkins`, `bowel_records`, `tags`, `bowel_record_tags`, `sleep_records`, `water_records`, `menstrual_records`

## Backups

- Manual export produces an encrypted `.plog` file (AES-256-GCM)
- Restore is replace-only: restoring overwrites current data (no merge)
- A safety backup is created and encrypted automatically before restore, and the restore is atomic

## Windows installer

Configured for NSIS target. After `npm run build:desktop`:

- Installer: `src-tauri/target/release/bundle/nsis/PoopLog_0.1.0_x64-setup.exe`
- Binary: `src-tauri/target/release/pooplog.exe` (or `app.exe` depending on Cargo name)

> ⚠️ **Warning:** the Windows installer is currently **unsigned**. Windows SmartScreen may show a warning when running it. No code signing or automatic updates yet.
