import { Spinner } from "@/components/ui/spinner";

/**
 * Full-screen "working on it" layer: dims and blocks the page while a step loads or saves,
 * so nothing underneath can be clicked twice. Render it only while busy.
 */
export function LoadingOverlay({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/70 backdrop-blur-[2px] animate-in fade-in-0 duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-xl border border-input bg-card px-5 py-4 shadow-lg">
        <Spinner size="md" label={label} />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
    </div>
  );
}
