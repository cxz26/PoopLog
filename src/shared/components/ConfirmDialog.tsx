import { useEffect, useRef } from "react";
import { Button } from "./Button";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", cancelLabel = "Cancel", onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    setTimeout(() => cancelRef.current?.focus(), 50);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <button className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onCancel} aria-label="Close dialog" tabIndex={-1} />
      <div className="relative w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
        <h2 id="confirm-title" className="text-base font-semibold text-zinc-900">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{message}</p>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
            aria-label={cancelLabel}
          >
            {cancelLabel}
          </button>
          <Button variant="danger" onClick={onConfirm} aria-label={confirmLabel}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
