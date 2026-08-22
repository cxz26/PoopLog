import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected, className = "", children, ...rest }: Props) {
  return (
    <button
      aria-pressed={selected}
      className={`inline-flex min-h-[36px] items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 ${
        selected ? "bg-amber-700 border-amber-700 text-white shadow-sm" : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
