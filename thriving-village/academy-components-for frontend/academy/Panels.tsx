import React from "react";
import { cn } from "@/lib/utils";

/** Page heading used across facilitator / judge / admin screens. */
export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[clamp(24px,4vw,32px)] font-bold leading-tight text-black [letter-spacing:var(--tv-track-tighter)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-[15px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
            {subtitle}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

/** A row of compact stat tiles. */
export function StatGrid({
  stats,
}: {
  stats: { label: string; value: string; note?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-card border border-gray-200 bg-white p-5 shadow-sm"
        >
          <p className="text-[28px] font-bold leading-none text-black [letter-spacing:var(--tv-track-tighter)]">
            {s.value}
          </p>
          <p className="mt-2 text-[13px] font-medium text-gray-500 [letter-spacing:var(--tv-track-tight)]">
            {s.label}
          </p>
          {s.note && <p className="mt-0.5 text-[12px] text-gray-400">{s.note}</p>}
        </div>
      ))}
    </div>
  );
}

/** A titled surface card with consistent padding. */
export function SectionCard({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-card border border-gray-200 bg-white shadow-sm",
        className,
      )}
    >
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
            {title}
          </h2>
          {action}
        </div>
      )}
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}
