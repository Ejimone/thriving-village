"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { PageHeading, StatGrid, SectionCard } from "@/components/academy/Panels";
import { TopRated } from "@/components/academy/TopRated";
import {
  ADMIN_ACTIVITY,
  ADMIN_COHORTS,
  ADMIN_STATS,
  CATEGORIES,
  ROSTER,
} from "@/lib/cohort";

export default function AdminOverview() {
  const running = ADMIN_COHORTS.filter((c) => c.status === "Running").slice(0, 5);

  return (
    <div>
      <PageHeading
        title="Platform overview"
        subtitle="Everything across the academy — categories, courses, cohorts, and people."
      />

      <StatGrid stats={ADMIN_STATS} />

      <div className="mt-6">
        <TopRated students={ROSTER} title="Top-rated talent" limit={5} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <SectionCard
          title="Active cohorts"
          action={
            <Link
              href="/academy/admin/cohorts"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-black hover:text-gray-600 [letter-spacing:var(--tv-track-tight)]"
            >
              All cohorts <ArrowRight size={14} />
            </Link>
          }
        >
          <ul className="flex flex-col">
            {running.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-4 border-t border-gray-150 py-3.5 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                    {c.course} · {c.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[13px] text-gray-500">
                    <Avatar name={c.facilitator} size={18} /> {c.facilitator}
                  </div>
                </div>
                <span className="text-[13px] text-gray-500 tabular-nums">
                  Wk {c.week}/{c.weeksTotal}
                </span>
                <span className="w-[64px] text-right text-[13px] font-semibold text-gray-700 tabular-nums">
                  {c.students}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Recent activity">
          <ul className="flex flex-col gap-4">
            {ADMIN_ACTIVITY.map((a, i) => (
              <li key={i} className="flex gap-3">
                <Avatar name={a.who === "System" || a.who === "A judge" ? "" : a.who} size={28} />
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-gray-700 [letter-spacing:var(--tv-track-tight)]">
                    <span className="font-semibold text-black">{a.who}</span> {a.what}
                  </p>
                  <p className="text-[12px] text-gray-400">{a.when}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title="Catalogue"
          action={
            <Link
              href="/academy/admin/curriculum"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-black hover:text-gray-600 [letter-spacing:var(--tv-track-tight)]"
            >
              Manage curriculum <ArrowRight size={14} />
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href="/academy/admin/curriculum"
                className="rounded-sm border border-gray-200 bg-white p-4 transition-colors hover:border-black"
              >
                <p className="text-[14px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
                  {cat.name}
                </p>
                <p className="mt-1 text-[13px] text-gray-500">
                  {cat.courses.length} courses
                </p>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
