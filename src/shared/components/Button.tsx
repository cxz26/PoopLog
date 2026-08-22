import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation";

const variants: Record<Variant, string> = {
  primary: "bg-amber-700 text-white hover:bg-amber-800 active:bg-amber-900 shadow-sm",
  secondary: "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 active:bg-zinc-100",
  ghost: "bg-transparent text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px] min-h-[44px]",
  lg: "h-13 px-7 text-base min-h-[48px]",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`} {...rest}>
      {children}
    </button>
  );
}
