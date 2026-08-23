export function HistoryEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-xl">📭</div>
      <p className="text-sm font-semibold text-zinc-900">No history yet</p>
      <p className="mt-1 text-sm text-zinc-600">Complete your first daily check-in to see it here.</p>
      <p className="mt-1 text-xs text-zinc-500">Only completed days appear — “no record” is not shown as “no bowel movement”.</p>
    </div>
  );
}
