import { useAppStore } from "../core/stores/appStore";
import { Dashboard } from "../features/dashboard/Dashboard";
import { QaPage } from "../qa/QaPage";

export function App() {
  const { databaseStatus, databaseError } = useAppStore();

  if (databaseStatus === "initializing" || databaseStatus === "idle") {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-700 text-white">💩</div>
          <p className="text-sm font-medium text-zinc-600" aria-live="polite">
            Initializing local database…
          </p>
          <p className="mt-1 text-xs text-zinc-400">PoopLog is local-first • Offline • Private</p>
        </div>
      </div>
    );
  }

  if (databaseStatus === "error") {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-red-700">Database error</p>
          <p className="mt-2 text-sm text-zinc-600">{databaseError ?? "Unknown error"}</p>
          <p className="mt-2 text-xs text-zinc-500">Please restart the app. Your data is stored locally in pooplog.db.</p>
        </div>
      </div>
    );
  }

  // QA harness — dev-only, no DB required, for responsive verification
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("qa") === "1") {
    return <QaPage />;
  }

  return <Dashboard />;
}

export default App;
