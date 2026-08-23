export function StatisticsEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-xl" aria-hidden>
        📊
      </div>
      <p className="text-sm font-semibold text-zinc-900">No statistics yet</p>
      <p className="mt-1 text-sm text-zinc-600">Complete a few daily check-ins to start seeing your trends.</p>
      <p className="mt-1 text-xs text-zinc-500">Your data stays on this device. Only completed days are counted.</p>
    </div>
  );
}
