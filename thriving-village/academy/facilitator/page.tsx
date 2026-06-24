"use client";

import Link from "next/link";
import { ArrowRight, AlertCircle, Star, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeading, StatGrid, SectionCard } from "@/components/academy/Panels";
import { TopRated } from "@/components/academy/TopRated";
import { useCohort, FRONTEND_ID } from "@/components/academy/CohortProvider";
import {
  COHORT,
  FACILITATOR,
  STANDING_LABEL,
  facilitatorCohorts,
  liveRoster,
  weekOf,
  type StudentStanding,
} from "@/lib/cohort";

const standingTone: Record<StudentStanding, "outline" | "neutral" | "inverse"> = {
  "on-track": "outline",
  behind: "neutral",
  "at-risk": "inverse",
};

export default function FacilitatorDashboard() {
  const { course, removed, shortlist, frontendEarlyRequested } = useCohort();
  const c = course(FRONTEND_ID);
  const myCohorts = facilitatorCohorts();

  const roster = liveRoster(c.currentDay - 1, removed);
  const total = roster.length;
  const avg = Math.round(
    (roster.reduce((sum, s) => sum + s.dayReached, 0) / total / COHORT.daysTotal) * 100,
  );
  const onTrack = roster.filter((s) => s.standing === "on-track").length;
  const attention = roster.filter((s) => s.standing !== "on-track").length;

  return (
    <div>
      <PageHeading
        title={`Welcome, ${FACILITATOR.name.split(" ")[0]}`}
        subtitle={`You run ${myCohorts.length} cohorts. ${COHORT.name} is your active workspace below.`}
      />

      {/* The facilitator only sees the cohorts they run. */}
      <SectionCard title="Your cohorts" className="mb-6">
        <ul className="flex flex-col">
          {myCohorts.map((mc) => (
            <li
              key={mc.id}
              className="flex flex-wrap items-center gap-3 border-t border-gray-150 py-3 first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                  {mc.course} · {mc.name}
                </p>
                <p className="text-[13px] text-gray-500">
                  {mc.students} students · Week {mc.week} of {mc.weeksTotal}
                </p>
              </div>
              {mc.courseId === FRONTEND_ID ? (
                <Badge tone="inverse" size="sm">Active workspace</Badge>
              ) : (
                <Link
                  href="/academy/facilitator/course"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-black hover:text-gray-600 [letter-spacing:var(--tv-track-tight)]"
                >
                  Manage course <ArrowRight size={14} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      <h2 className="mb-3 text-[15px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
        {COHORT.name}
      </h2>

      <StatGrid
        stats={[
          { label: "Students", value: String(total) },
          { label: "Avg. completion", value: `${avg}%` },
          { label: "On track", value: String(onTrack) },
          { label: "Need attention", value: String(attention) },
        ]}
      />

      {(frontendEarlyRequested || shortlist.length > 0 || removed.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-3">
          {frontendEarlyRequested && (
            <Link
              href="/academy/facilitator/course"
              className="flex flex-1 items-center justify-between gap-3 rounded-card border border-black bg-black px-5 py-4 text-white transition-colors hover:bg-gray-900"
            >
              <span className="flex items-center gap-3">
                <AlertCircle size={18} />
                <span className="text-[15px] font-semibold [letter-spacing:var(--tv-track-tight)]">
                  A student finished Week {weekOf(c.currentDay)} early — early-access request waiting.
                </span>
              </span>
              <ArrowRight size={18} />
            </Link>
          )}
          {shortlist.length > 0 && (
            <span className="inline-flex items-center gap-2 rounded-card border border-gray-200 bg-white px-5 py-4 text-[14px] font-semibold text-gray-700 [letter-spacing:var(--tv-track-tight)]">
              <Star size={16} className="text-gray-400" /> {shortlist.length} shortlisted
            </span>
          )}
          {removed.length > 0 && (
            <span className="inline-flex items-center gap-2 rounded-card border border-gray-200 bg-white px-5 py-4 text-[14px] font-semibold text-gray-700 [letter-spacing:var(--tv-track-tight)]">
              <Trash2 size={16} className="text-gray-400" /> {removed.length} in the bin
            </span>
          )}
        </div>
      )}

      <div className="mt-6">
        <TopRated
          students={roster}
          title="Top-rated students"
          limit={3}
          profileHref={(id) => `/academy/facilitator/students/${id}`}
        />
      </div>

      <div className="mt-6">
        <SectionCard title="All students" action={<span className="text-[13px] text-gray-400">Click a student to view their profile</span>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="text-left text-[12px] font-bold uppercase tracking-[0.04em] text-gray-400">
                  <th className="pb-3 pr-4 font-bold">Student</th>
                  <th className="pb-3 pr-4 font-bold">Week</th>
                  <th className="pb-3 pr-4 font-bold">Completion</th>
                  <th className="pb-3 pr-4 font-bold">Standing</th>
                  <th className="pb-3 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => {
                  const pct = Math.round((s.dayReached / COHORT.daysTotal) * 100);
                  return (
                    <tr
                      key={s.id}
                      className="border-t border-gray-150 align-middle transition-colors hover:bg-gray-50"
                    >
                      <td className="py-0 pr-4">
                        <Link
                          href={`/academy/facilitator/students/${s.id}`}
                          className="flex items-center gap-2.5 py-3"
                        >
                          <Avatar name={s.name} size={30} />
                          <span className="text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                            {s.name}
                          </span>
                          {shortlist.includes(s.id) && (
                            <Star size={13} className="fill-black text-black" />
                          )}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-[14px] text-gray-600 tabular-nums">
                        Wk {weekOf(s.dayReached)} · Day {s.dayReached}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="flex items-center gap-2">
                          <ProgressBar value={pct} className="w-24" />
                          <span className="text-[13px] font-semibold text-gray-600 tabular-nums">
                            {pct}%
                          </span>
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={standingTone[s.standing]} size="sm">
                          {STANDING_LABEL[s.standing]}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/academy/facilitator/students/${s.id}`}
                          className="text-gray-300 transition-colors hover:text-black"
                          aria-label={`View ${s.name}`}
                        >
                          <ArrowRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
