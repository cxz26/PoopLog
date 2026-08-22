import type { HTMLAttributes } from "react";

export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}
