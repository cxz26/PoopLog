import { Button } from "../../../shared/components/Button";

interface Props {
  onYes: () => void;
  onNo: () => void;
  loading?: boolean;
}

export function CheckinPrompt({ onYes, onNo, loading }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-center text-lg font-bold text-zinc-900">Did you have a bowel movement today?</h2>
      <p className="mt-1 text-center text-sm text-zinc-600">Takes 20–30 seconds • You can change your answer later</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          size="lg"
          onClick={onNo}
          disabled={loading}
          aria-label="No bowel movement today"
          className="border-zinc-300"
        >
          NO
        </Button>
        <Button variant="primary" size="lg" onClick={onYes} disabled={loading} aria-label="Yes, I had a bowel movement">
          YES
        </Button>
      </div>
    </div>
  );
}
