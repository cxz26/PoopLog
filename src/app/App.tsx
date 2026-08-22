import { useAppStore } from "../core/stores/appStore";
import { StatusRow } from "../shared/components/StatusRow";
import { APP_NAME, APP_TAGLINE } from "../shared/constants";

export function App() {
  const { isTauri, databaseStatus, databaseError } = useAppStore();

  const desktopStatus = isTauri ? "ok" : "pending";
  const dbStatus =
    databaseStatus === "ready"
      ? "ok"
      : databaseStatus === "error"
        ? "error"
        : databaseStatus === "initializing"
          ? "pending"
          : "pending";

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Title bar spacer for Tauri window */}
      <div className="mx-auto flex min-h-screen max-w-[880px] flex-col px-6 py-10">
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-700 text-2xl text-white shadow-sm">
            💩
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">{APP_NAME}</h1>
          <p className="mt-1 text-lg font-medium text-zinc-600">Desktop App</p>
          <p className="mt-2 text-sm font-medium tracking-wide text-zinc-500">{APP_TAGLINE}</p>
        </header>

        {/* Card */}
        <main className="mx-auto w-full max-w-[520px] rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">System status</h2>

          <div className="flex flex-col gap-3">
            <StatusRow
              label="Desktop environment initialized"
              status={desktopStatus}
              detail={isTauri ? "Tauri • Windows" : "Browser preview"}
            />
            <StatusRow
              label="Local database ready"
              status={dbStatus}
              detail={
                databaseStatus === "ready"
                  ? "SQLite • pooplog.db"
                  : databaseStatus === "initializing"
                    ? "Initializing…"
                    : databaseStatus === "error"
                      ? (databaseError ?? "Error")
                      : "Waiting…"
              }
            />
            <StatusRow label="Running locally" status="ok" detail="Offline • Private" />
          </div>

          <div className="mt-6 rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-600">
            <p>
              This is the Phase 1 placeholder. The desktop shell, local SQLite layer, and offline-first
              architecture are initialized. No health data leaves this device.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              DB location: <code className="rounded bg-white px-1.5 py-0.5 text-xs">AppData / pooplog.db</code> (Tauri app-data).
              Migrations: versioned via <code className="px-1">_migrations</code>.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-xs text-zinc-400">
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">React + Vite</span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">Tauri 2 + Rust</span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">SQLite</span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">Zustand</span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">Tailwind</span>
          </div>
        </main>

        <footer className="mt-auto pt-8 text-center text-xs text-zinc-400">
          PoopLog Desktop • Phase 1 • Local-first, private by design
        </footer>
      </div>
    </div>
  );
}

export default App;
