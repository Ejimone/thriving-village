"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Lock,
  CalendarPlus,
  Zap,
  ChevronRight,
  ChevronDown,
  Play,
  FileVideo,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PageHeading, SectionCard } from "@/components/academy/Panels";
import { useCohort, FRONTEND_ID } from "@/components/academy/CohortProvider";
import { toast } from "@/components/ui/Toaster";
import {
  COHORT,
  ME,
  facilitatorCourses,
  getDay,
  weekOf,
  weekStartDay,
} from "@/lib/cohort";

type WeekStatus = "live" | "early" | "upcoming";

export default function CourseManager() {
  const { course, getMaterial, rolloutNextWeek, grantEarlyAccess, frontendEarlyRequested } =
    useCohort();
  const courses = facilitatorCourses();

  const [courseId, setCourseId] = useState(courses[0]?.courseId ?? FRONTEND_ID);
  const [openWeek, setOpenWeek] = useState<number | null>(1);

  const selected = courses.find((co) => co.courseId === courseId) ?? courses[0];
  const weeksTotal = selected?.weeksTotal ?? COHORT.weeksTotal;
  const isActive = courseId === FRONTEND_ID; // the live cohort being rolled out
  const c = course(FRONTEND_ID);
  const studentWeek = weekOf(c.currentDay);

  const statusOf = (week: number): WeekStatus => {
    if (week <= c.releasedWeek) return "live";
    if (c.earlyWeeks.includes(week)) return "early";
    return "upcoming";
  };

  const rollout = () => {
    rolloutNextWeek(FRONTEND_ID);
    toast.success(`Week ${Math.min(COHORT.weeksTotal, c.releasedWeek + 1)} rolled out to the cohort.`);
  };
  const grant = () => {
    grantEarlyAccess(FRONTEND_ID);
    toast.success(`Early access granted. Week ${c.releasedWeek + 1} is open for them now.`);
  };

  return (
    <div>
      <PageHeading
        title="Course manager"
        subtitle="Roll out the weeks for your live cohort, and open any week to manage its lessons."
      >
        {courses.length > 1 && (
          <div className="w-[230px]">
            <Select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setOpenWeek(1);
              }}
              options={courses.map((co) => ({ label: co.title, value: co.courseId }))}
            />
          </div>
        )}
      </PageHeading>

      {/* Rollout + early access apply to the live cohort only */}
      {isActive ? (
        <>
          <SectionCard className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
                  Currently live
                </p>
                <p className="mt-1 text-[20px] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
                  Week {c.releasedWeek} of {COHORT.weeksTotal}
                </p>
                <p className="mt-1 text-[14px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                  {getDay(weekStartDay(c.releasedWeek), FRONTEND_ID).theme}. Week{" "}
                  {Math.min(COHORT.weeksTotal, c.releasedWeek + 1)} opens automatically next Monday.
                </p>
              </div>
              <Button
                variant="outline"
                iconLeft={<CalendarPlus size={18} />}
                onClick={rollout}
                disabled={c.releasedWeek >= COHORT.weeksTotal}
              >
                Roll out next week now
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Early-access requests" className="mb-6">
            {frontendEarlyRequested ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar name={ME.name} size={36} />
                  <div>
                    <p className="text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                      {ME.name}
                    </p>
                    <p className="text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                      Finished Week {studentWeek} early — requesting Week {studentWeek + 1}.
                    </p>
                  </div>
                </div>
                <Button variant="inverse" iconLeft={<Zap size={17} />} onClick={grant}>
                  Grant early access
                </Button>
              </div>
            ) : (
              <p className="text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
                No early-access requests right now. They appear here when a student finishes
                the live week ahead of schedule.
              </p>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard className="mb-6">
          <p className="text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            {selected?.title} isn&apos;t your live rollout cohort — you can still open any week
            below to manage its lessons.
          </p>
        </SectionCard>
      )}

      {/* Weeks → lessons */}
      <SectionCard title="Weeks & lessons">
        <div className="flex flex-col gap-1">
          {Array.from({ length: weeksTotal }, (_, i) => i + 1).map((week) => {
            const open = openWeek === week;
            const status = statusOf(week);
            return (
              <div key={week} className="border-b border-gray-150 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenWeek(open ? null : week)}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  {isActive ? (
                    <WeekIcon status={status} />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-gray-200 text-gray-400">
                      {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                      Week {week}
                      {isActive && week === studentWeek && (
                        <span className="ml-2 text-[12px] font-medium text-gray-400">
                          · student is here
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[13px] text-gray-500">
                      {getDay(weekStartDay(week), courseId).theme}
                    </p>
                  </div>
                  {isActive && <WeekBadge status={status} />}
                  <span className="text-gray-300">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                </button>

                {open && (
                  <ul className="mb-2 ml-11 flex flex-col gap-0.5 border-l border-gray-150 pl-3">
                    {Array.from({ length: 7 }, (_, d) => d + 1).map((d) => {
                      const dayNum = (week - 1) * 7 + d;
                      const content = getDay(dayNum, courseId);
                      const hasMaterial = !!getMaterial(courseId, dayNum);
                      return (
                        <li key={d}>
                          <Link
                            href={`/academy/facilitator/lesson/${courseId}/${dayNum}`}
                            className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13.5px] text-gray-700 transition-colors hover:bg-gray-100 [letter-spacing:var(--tv-track-tight)]"
                          >
                            <span className="w-[46px] shrink-0 font-semibold text-gray-500 tabular-nums">
                              Day {dayNum}
                            </span>
                            <Play size={12} className="shrink-0 text-gray-400" />
                            <span className="min-w-0 flex-1 truncate">{content.title}</span>
                            {hasMaterial && (
                              <FileVideo size={13} className="shrink-0 text-black" />
                            )}
                            <ChevronRight size={14} className="shrink-0 text-gray-300" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

function WeekIcon({ status }: { status: WeekStatus }) {
  const cls = "flex h-8 w-8 shrink-0 items-center justify-center rounded-pill";
  if (status === "live")
    return (
      <span className={`${cls} bg-black text-white`}>
        <Check size={16} />
      </span>
    );
  if (status === "early")
    return (
      <span className={`${cls} border-[1.5px] border-black text-black`}>
        <Zap size={15} />
      </span>
    );
  return (
    <span className={`${cls} border border-gray-200 text-gray-300`}>
      <Lock size={13} />
    </span>
  );
}

function WeekBadge({ status }: { status: WeekStatus }) {
  if (status === "live") return <Badge tone="neutral" size="sm">Live</Badge>;
  if (status === "early") return <Badge tone="inverse" size="sm">Early access</Badge>;
  return <Badge tone="outline" size="sm">Upcoming</Badge>;
}
