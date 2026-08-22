type Props = {
  label: string;
  status: "ok" | "pending" | "error";
  detail?: string;
};

const icons = {
  ok: "✓",
  pending: "○",
  error: "✕",
};

const color: Record<Props["status"], string> = {
  ok: "text-emerald-600",
  pending: "text-amber-600",
  error: "text-red-600",
};

export function StatusRow({ label, status, detail }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm">
      <span className={`text-base font-bold ${color[status]}`}>{icons[status]}</span>
      <span className="font-medium text-zinc-800">{label}</span>
      {detail && <span className="ml-auto text-xs text-zinc-500">{detail}</span>}
    </div>
  );
}
