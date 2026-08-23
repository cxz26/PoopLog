import { useState } from "react";
import { useAppStore } from "../core/stores/appStore";
import { Dashboard } from "../features/dashboard/Dashboard";
import { HistoryPage } from "../features/history/HistoryPage";
import { QaPage } from "../qa/QaPage";

export function App() {
  const { databaseStatus, databaseError } = useAppStore();
  const [view, setView] = useState<"dashboard" | "history">("dashboard");

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

  return (
    <div>
      <nav className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-[880px] items-center gap-2 px-4 py-2 sm:px-6">
          <span className="text-sm font-bold text-zinc-900">PoopLog</span>
          <div className="ml-auto flex gap-1" role="tablist" aria-label="Main navigation">
            <button
              role="tab"
              aria-selected={view === "dashboard"}
              aria-controls="dashboard-panel"
              onClick={() => setView("dashboard")}
              className={`min-h-[36px] rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                view === "dashboard" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              Today
            </button>
            <button
              role="tab"
              aria-selected={view === "history"}
              aria-controls="history-panel"
              onClick={() => setView("history")}
              className={`min-h-[36px] rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                view === "history" ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              History
            </button>
          </div>
        </div>
      </nav>
      <div id="dashboard-panel" role="tabpanel" hidden={view !== "dashboard"} aria-labelledby="dashboard-tab">
        {view === "dashboard" && <Dashboard />}
      </div>
      <div id="history-panel" role="tabpanel" hidden={view !== "history"} aria-labelledby="history-tab">
        {view === "history" && <HistoryPage onBack={() => setView("dashboard")} />}
      </div>
    </div>
  );
}

export default App;
