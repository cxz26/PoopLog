interface Props {
  streak: number;
}

export function StreakBadge({ streak }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
      <span className="text-lg" aria-hidden>🔥</span>
      <div className="flex flex-col leading-none">
        <span className="text-sm font-bold text-amber-900">{streak} day streak</span>
        <span className="text-xs text-amber-700">{streak === 0 ? "Start today!" : streak === 1 ? "Keep going!" : "You're consistent!"}</span>
      </div>
    </div>
  );
}
