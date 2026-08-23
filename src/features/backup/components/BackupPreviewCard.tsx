interface BackupPreview {
  createdAt: string;
  appVersion: string;
  schemaVersion: number;
  counts: {
    daily_checkins: number;
    bowel_records: number;
    tags: number;
    customTags?: number;
  };
  dateRange: { earliest: string | null; latest: string | null };
}

interface Props {
  preview: BackupPreview;
}

export function BackupPreviewCard({ preview }: Props) {
  const hasRecords = preview.counts.daily_checkins > 0 || preview.counts.bowel_records > 0;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold text-zinc-900">PoopLog Backup</h3>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase text-zinc-500">Created</p>
          <p className="mt-1 font-medium text-zinc-900">{new Date(preview.createdAt).toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase text-zinc-500">Application</p>
          <p className="mt-1 font-medium text-zinc-900">{preview.appVersion}</p>
          <p className="text-xs text-zinc-500">Schema {preview.schemaVersion}</p>
        </div>
        <div className="rounded-xl bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase text-zinc-500">Records</p>
          <p className="mt-1 font-medium text-zinc-900">{preview.counts.bowel_records} bowel records</p>
        </div>
        <div className="rounded-xl bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase text-zinc-500">Daily check-ins</p>
          <p className="mt-1 font-medium text-zinc-900">{preview.counts.daily_checkins}</p>
        </div>
        <div className="rounded-xl bg-zinc-50 p-3 col-span-2">
          <p className="text-xs font-semibold uppercase text-zinc-500">Date range</p>
          <p className="mt-1 font-medium text-zinc-900">
            {preview.dateRange.earliest && preview.dateRange.latest ? `${preview.dateRange.earliest} → ${preview.dateRange.latest}` : "No health records in this backup."}
          </p>
        </div>
        <div className="rounded-xl bg-zinc-50 p-3 col-span-2">
          <p className="text-xs font-semibold uppercase text-zinc-500">Custom tags</p>
          <p className="mt-1 font-medium text-zinc-900">{preview.counts.customTags ?? preview.counts.tags}</p>
        </div>
      </div>

      {!hasRecords && <p className="text-sm text-zinc-600">No health records in this backup.</p>}
    </div>
  );
}
