"use client";

import { Check, Lock } from "lucide-react";
import { DAYS_PER_WEEK, weekOf, weekStartDay } from "@/lib/cohort";
import { cn } from "@/lib/utils";

/**
 * The 7-day strip. Shows the current week.
 *  - Past days   completed (quiet checkmark), clickable to review
 *  - Today       highlighted
 *  - Future days locked/greyed, not clickable
 */
export function DayStrip({
  currentDay,
  selectedDay,
  daysTotal,
  weeksTotal,
  isSubmitted,
  onSelect,
}: {
  currentDay: number;
  selectedDay: number;
  daysTotal: number;
  weeksTotal: number;
  isSubmitted: (day: number) => boolean;
  onSelect: (day: number) => void;
}) {
  const week = weekOf(currentDay);
  const start = weekStartDay(week);
  const days = Array.from({ length: DAYS_PER_WEEK }, (_, i) => start + i).filter(
    (d) => d <= daysTotal,
  );

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
          Week {week} of {weeksTotal}
        </h2>
        <span className="text-xs text-gray-400">Day {currentDay} of {daysTotal}</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const isToday = day === currentDay;
          const isFuture = day > currentDay;
          const done = isSubmitted(day) && !isToday;
          const isSelected = day === selectedDay;

          const base =
            "flex flex-col items-center justify-center gap-1.5 rounded-sm border py-3 transition-colors";

          return (
            <button
              key={day}
              type="button"
              disabled={isFuture}
              onClick={() => !isFuture && onSelect(day)}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                base,
                isToday && "border-black bg-black text-white",
                done && "border-gray-200 bg-white text-gray-700 hover:border-gray-400",
                isFuture && "cursor-not-allowed border-gray-150 bg-gray-50 text-gray-300",
                !isToday && !done && !isFuture && "border-gray-200 bg-white text-gray-700 hover:border-gray-400",
                isSelected && !isToday && "ring-2 ring-black ring-offset-2 ring-offset-paper",
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-medium uppercase tracking-[0.04em]",
                  isToday ? "text-white/70" : isFuture ? "text-gray-300" : "text-gray-400",
                )}
              >
                Day
              </span>
              <span className="text-lg font-bold leading-none tabular-nums [letter-spacing:var(--tv-track-tight)]">
                {day}
              </span>
              <span className="flex h-4 items-center justify-center">
                {done ? (
                  <Check size={14} className="text-gray-400" />
                ) : isFuture ? (
                  <Lock size={12} className="text-gray-300" />
                ) : isToday ? (
                  <span className="h-1.5 w-1.5 rounded-pill bg-white" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
