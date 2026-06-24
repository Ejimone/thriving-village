"use client";

import { useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { SectionCard } from "@/components/academy/Panels";
import { studentAvgScore, type CohortStudent } from "@/lib/cohort";

/**
 * Best-rated students first — the people to "fish out". Shows a short list by
 * default with an option to open up the full ranking.
 */
export function TopRated({
  students,
  title = "Top-rated students",
  limit = 5,
  profileHref,
}: {
  students: CohortStudent[];
  title?: string;
  limit?: number;
  /** When provided, each row links to the student's profile. */
  profileHref?: (id: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const ranked = [...students]
    .filter((s) => studentAvgScore(s) > 0)
    .sort((a, b) => studentAvgScore(b) - studentAvgScore(a));
  const shown = expanded ? ranked : ranked.slice(0, limit);

  return (
    <SectionCard
      title={title}
      action={
        ranked.length > limit ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[13px] font-semibold text-black hover:text-gray-600 [letter-spacing:var(--tv-track-tight)]"
          >
            {expanded ? "Show top few" : `View all ${ranked.length}`}
          </button>
        ) : undefined
      }
    >
      <ol className="flex flex-col">
        {shown.map((s, i) => {
          const score = studentAvgScore(s);
          const row = (
            <span className="flex items-center gap-3 py-2.5">
              <span className="w-5 shrink-0 text-[13px] font-bold tabular-nums text-gray-400">
                {i + 1}
              </span>
              <Avatar name={s.name} size={30} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                {s.name}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[14px] font-bold text-black">
                <Star size={14} className="fill-black text-black" /> {score}
              </span>
            </span>
          );
          return (
            <li key={s.id} className="border-t border-gray-150 first:border-t-0">
              {profileHref ? (
                <Link href={profileHref(s.id)} className="block transition-colors hover:bg-gray-50">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}
