import { useEffect } from "react";
import { isTauri } from "../../core/utils/platform";
import { initDatabase } from "../../core/database";
import { useAppStore } from "../../core/stores/appStore";
import { installDevReset } from "../../core/database/devReset";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const { setIsTauri, setDatabaseStatus } = useAppStore();

  useEffect(() => {
    const tauri = isTauri();
    setIsTauri(tauri);

    let cancelled = false;

    async function boot() {
      setDatabaseStatus("initializing");
      try {
        const db = await initDatabase();
        if (cancelled) return;
        // In browser, db === null but we treat as ready for placeholder purposes
        // In Tauri, db must be non-null
        if (tauri && !db) {
          setDatabaseStatus("error", "Database returned null in Tauri");
        } else {
          setDatabaseStatus("ready");
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setDatabaseStatus("error", msg);
      }
    }

    boot();
    installDevReset();

    // Phase 2 verification harness — dev-only, not bundled in production
    if (import.meta.env.DEV) {
      if (import.meta.env.VITE_VERIFY_PHASE2 === "1" && tauri) {
        import(/* @vite-ignore */ "../../core/database/verifyPhase2").then((m) => {
          // small delay to let DB init complete
          setTimeout(() => {
            m.runPhase2Verification().catch((e) => console.error("[verify] auto-run failed", e));
          }, 800);
        });
      } else {
        // Always install verify hook for manual DEV invocation (dev-only)
        import(/* @vite-ignore */ "../../core/database/verifyPhase2").catch(() => {});
      }
    }

    return () => {
      cancelled = true;
    };
  }, [setIsTauri, setDatabaseStatus]);

  return <>{children}</>;
}
