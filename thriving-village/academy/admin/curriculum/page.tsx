"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Award,
  Play,
  ClipboardList,
  FileVideo,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { PageHeading, SectionCard } from "@/components/academy/Panels";
import { MaterialEditor } from "@/components/academy/MaterialEditor";
import { useCohort } from "@/components/academy/CohortProvider";
import { CATEGORIES, ALL_COURSES } from "@/lib/cohort";
import { cn } from "@/lib/utils";

const LESSON_CYCLE = ["Concepts", "Walkthrough", "Practice", "Build", "Apply", "Review", "Ship"];

export default function CurriculumPage() {
  const { getMaterial } = useCohort();
  const [openCat, setOpenCat] = useState<string | null>(CATEGORIES[0].id);
  const [courseId, setCourseId] = useState<string>(CATEGORIES[0].courses[0].id);
  const [openWeek, setOpenWeek] = useState<number | null>(1);
  const [openDay, setOpenDay] = useState<number | null>(null);

  const course = ALL_COURSES.find((c) => c.id === courseId) ?? ALL_COURSES[0];
  const weeks = course.months * 4;

  return (
    <div>
      <PageHeading
        title="Curriculum"
        subtitle="Categories hold courses; courses break into weeks, days, lessons, and tasks."
      />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Category → course tree */}
        <SectionCard title="Catalogue" className="self-start">
          <div className="flex flex-col gap-1">
            {CATEGORIES.map((cat) => {
              const open = openCat === cat.id;
              return (
                <div key={cat.id}>
                  <button
                    type="button"
                    onClick={() => setOpenCat(open ? null : cat.id)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left hover:bg-gray-100"
                  >
                    {open ? (
                      <ChevronDown size={15} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={15} className="text-gray-400" />
                    )}
                    <span className="flex-1 text-[14px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
                      {cat.name}
                    </span>
                    <span className="text-[12px] text-gray-400">{cat.courses.length}</span>
                  </button>
                  {open && (
                    <ul className="ml-4 flex flex-col gap-0.5 border-l border-gray-150 pl-2">
                      {cat.courses.map((co) => (
                        <li key={co.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCourseId(co.id);
                              setOpenWeek(1);
                            }}
                            className={cn(
                              "w-full rounded-sm px-2.5 py-1.5 text-left text-[13.5px] [letter-spacing:var(--tv-track-tight)] transition-colors",
                              co.id === courseId
                                ? "bg-black font-semibold text-white"
                                : "text-gray-700 hover:bg-gray-100",
                            )}
                          >
                            {co.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Course detail */}
        <div>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-card border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
                {course.category}
              </p>
              <h2 className="mt-1 text-[22px] font-bold leading-tight text-black [letter-spacing:var(--tv-track-tighter)]">
                {course.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="outline" size="sm">{course.months} months</Badge>
                <Badge tone="outline" size="sm">{weeks} weeks · {weeks * 7} days</Badge>
                {course.certificate && (
                  <Badge tone="neutral" size="sm">
                    <Award size={12} /> Certificate
                  </Badge>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              iconLeft={<Plus size={15} />}
              onClick={() => toast.success("Week added to the outline.")}
            >
              Add week
            </Button>
          </div>

          <SectionCard title="Outline">
            <div className="flex flex-col gap-1">
              {Array.from({ length: weeks }, (_, i) => i + 1).map((week) => {
                const open = openWeek === week;
                return (
                  <div key={week} className="border-b border-gray-150 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpenWeek(open ? null : week)}
                      className="flex w-full items-center gap-2 py-2.5 text-left"
                    >
                      {open ? (
                        <ChevronDown size={15} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={15} className="text-gray-400" />
                      )}
                      <span className="flex-1 text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                        Week {week}
                      </span>
                      <span className="text-[12px] text-gray-400">7 days</span>
                    </button>
                    {open && (
                      <ul className="mb-2 ml-5 flex flex-col gap-1 border-l border-gray-150 pl-3">
                        {Array.from({ length: 7 }, (_, d) => d + 1).map((d) => {
                          const dayNum = (week - 1) * 7 + d;
                          const type = LESSON_CYCLE[d - 1];
                          const hasMaterial = !!getMaterial(courseId, dayNum);
                          const editing = openDay === dayNum;
                          return (
                            <li key={d} className="py-1.5">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="w-[52px] text-[13px] font-semibold text-gray-500 tabular-nums">
                                  Day {dayNum}
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-600">
                                  <Play size={12} className="text-gray-400" /> {type} lesson
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-600">
                                  <ClipboardList size={12} className="text-gray-400" /> Task
                                </span>
                                {hasMaterial && (
                                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-black">
                                    <FileVideo size={12} /> Material
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setOpenDay(editing ? null : dayNum)}
                                  className="ml-auto text-[12px] font-semibold text-gray-500 hover:text-black [letter-spacing:var(--tv-track-tight)]"
                                >
                                  {editing ? "Close" : hasMaterial ? "Edit material" : "Add material"}
                                </button>
                              </div>
                              {editing && (
                                <MaterialEditor
                                  key={`${courseId}:${dayNum}`}
                                  courseId={courseId}
                                  day={dayNum}
                                />
                              )}
                            </li>
                          );
                        })}
                        <li className="pt-1">
                          <button
                            type="button"
                            onClick={() => toast.success(`Day added to Week ${week}.`)}
                            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 hover:text-black [letter-spacing:var(--tv-track-tight)]"
                          >
                            <Plus size={13} /> Add day
                          </button>
                        </li>
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
