"use client";

import Link from "next/link";
import { ArrowRight, Award } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { useCohort } from "@/components/academy/CohortProvider";
import { ME } from "@/lib/cohort";

const statusTone = {
  "In progress": "neutral",
  "Starting soon": "outline",
  Completed: "inverse",
} as const;

export default function MyCourses() {
  const { enrollments, course } = useCohort();

  return (
    <div className="tv-container py-8">
      <div className="mx-auto max-w-[760px]">
        <p className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
          Welcome back, {ME.name.split(" ")[0]}
        </p>
        <h1 className="mt-1 font-serif text-[clamp(26px,4vw,34px)] leading-tight text-black">
          My courses
        </h1>
        <p className="mt-2 text-[15px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          You&apos;re enrolled in {enrollments.length} courses. Choose one to pick up
          where you left off.
        </p>

        <div className="mt-7 flex flex-col gap-4">
          {enrollments.map((e) => {
            const c = course(e.courseId);
            const starting = e.status === "Starting soon";
            return (
              <Link
                key={e.courseId}
                href={`/academy/student/${e.courseId}`}
                className="group flex flex-col gap-4 rounded-card border border-gray-200 bg-white p-6 shadow-sm transition-colors hover:border-black sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
                      {e.category} · {e.cohortName}
                    </p>
                    <Badge tone={statusTone[e.status]} size="sm">
                      {e.status}
                    </Badge>
                  </div>
                  <h2 className="mt-1.5 text-[22px] font-bold leading-tight text-black [letter-spacing:var(--tv-track-tighter)]">
                    {e.title}
                  </h2>
                  <p className="mt-1 text-[13px] text-gray-500">
                    Facilitator · {e.facilitator}
                  </p>

                  <div className="mt-4 max-w-[360px]">
                    <div className="mb-1.5 flex items-center justify-between text-[12px] text-gray-500">
                      <span>{starting ? "Begins soon" : `Day ${c.currentDay} of ${e.daysTotal}`}</span>
                      <span className="font-semibold text-black tabular-nums">
                        {c.progressPct}%
                      </span>
                    </div>
                    <ProgressBar value={c.progressPct} />
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                    {starting ? "Preview" : "Continue"}
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="mt-6 flex items-center gap-2 text-[13px] text-gray-400 [letter-spacing:var(--tv-track-tight)]">
          <Award size={14} /> Professional tracks award a certificate on completion.
        </p>
      </div>
    </div>
  );
}
