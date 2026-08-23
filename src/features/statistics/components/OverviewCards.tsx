import type { OverviewStats } from "../../../core/services/statisticsService";

interface Props {
  stats: OverviewStats;
}

export function OverviewCards({ stats }: Props) {
  const cards = [
    { label: "Total bowel movements", value: stats.totalBowelMovements },
    { label: "Days with bowel movement", value: stats.daysWithBM },
    { label: "Days without bowel movement", value: stats.daysWithoutBM },
    { label: "Days not recorded", value: stats.daysNotRecorded },
    { label: "Avg per logged day", value: stats.avgPerLoggedDay != null ? stats.avgPerLoggedDay.toFixed(1) : "—" },
    { label: "Current streak", value: `${stats.currentStreak} days`, sub: "logging streak (any completed day)" },
    { label: "Longest streak", value: `${stats.longestStreak} days`, sub: "longest completed run" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{c.label}</p>
          <p className="mt-1 text-lg font-bold text-zinc-900">{c.value}</p>
          {c.sub && <p className="text-xs text-zinc-500">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}
