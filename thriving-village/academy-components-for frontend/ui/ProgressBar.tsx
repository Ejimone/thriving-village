import React from "react";
import { cn } from "@/lib/utils";

/** Slim progress bar. Neutral by default; accent is opt-in (one per page). */
export function ProgressBar({
  value,
  accent,
  showLabel = false,
  className,
}: {
  value: number; // 0–100
  accent?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1 h-2 rounded-pill bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-pill transition-all duration-300"
          style={{ width: `${pct}%`, background: accent ?? "var(--tv-black)" }}
        />
      </div>
      {showLabel && (
        <span className="text-[13px] font-semibold text-gray-600 tabular-nums [letter-spacing:var(--tv-track-tight)]">
          {pct}%
        </span>
      )}
    </div>
  );
}
