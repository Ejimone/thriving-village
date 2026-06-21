"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Play,
  Check,
  CircleCheck,
  Circle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";
import { markLessonCompleteAction } from "@/lib/actions/progress";
import type { Course } from "@/lib/data";

export function LessonViewer({
  course,
  lessonId,
  initialCompleted,
}: {
  course: Course;
  lessonId: string;
  initialCompleted: string[];
}) {
  const flat = course.modules.flatMap((m) =>
    m.lessons.map((l) => ({ ...l, module: m.title })),
  );
  const current = flat.find((l) => l.id === lessonId) ?? flat[0];
  const currentIndex = flat.findIndex((l) => l.id === current.id);
  const next = flat[currentIndex + 1];

  const [completed, setCompleted] = useState<Record<string, boolean>>(
    () => Object.fromEntries(initialCompleted.map((id) => [id, true])),
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  const doneCount = Object.values(completed).filter(Boolean).length;
  const progress = Math.round((doneCount / flat.length) * 100);

  function markComplete() {
    setCompleted((c) => ({ ...c, [current.id]: true })); // optimistic
    startTransition(async () => {
      const result = await markLessonCompleteAction(course.dbId, current.id);
      if (result.error) {
        setCompleted((c) => ({ ...c, [current.id]: false }));
        toast.error(result.error);
        return;
      }
      toast.success(
        next ? "Lesson complete. On to the next one." : "Course complete. Well done!",
      );
    });
  }

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/* Sidebar curriculum */}
      {sidebarOpen && (
        <aside className="w-full shrink-0 border-b border-gray-200 bg-white lg:w-[320px] lg:border-b-0 lg:border-r">
          <div className="border-b border-gray-200 p-5">
            <Link
              href={`/courses/${course.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black [letter-spacing:var(--tv-track-tight)]"
            >
              <ArrowLeft size={16} /> {course.title}
            </Link>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[13px] text-gray-500">
                <span>Your progress</span>
                <span className="font-semibold text-black">{progress}%</span>
              </div>
              <ProgressBar value={progress} />
            </div>
          </div>
          <nav className="max-h-[60vh] overflow-auto p-3 lg:max-h-[calc(100vh-220px)]">
            {course.modules.map((m, mi) => (
              <div key={m.title} className="mb-4">
                <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
                  Module {mi + 1} · {m.title}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {m.lessons.map((l) => {
                    const active = l.id === current.id;
                    const done = completed[l.id];
                    return (
                      <li key={l.id}>
                        <Link
                          href={`/courses/${course.id}/lessons/${l.id}`}
                          className={cn(
                            "flex items-center gap-2.5 rounded-sm px-2.5 py-2.5 text-[14px] [letter-spacing:var(--tv-track-tight)]",
                            active
                              ? "bg-black text-white"
                              : "text-gray-700 hover:bg-gray-100",
                          )}
                        >
                          {done ? (
                            <CircleCheck
                              size={16}
                              className={active ? "text-white" : "text-success"}
                            />
                          ) : (
                            <Circle
                              size={16}
                              className={active ? "text-white/70" : "text-gray-300"}
                            />
                          )}
                          <span className="flex-1">{l.title}</span>
                          <span
                            className={cn(
                              "text-[12px]",
                              active ? "text-white/70" : "text-gray-400",
                            )}
                          >
                            {l.duration}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
      )}

      {/* Lesson content */}
      <div className="flex-1">
        <div className="mx-auto max-w-[760px] px-6 py-8">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black [letter-spacing:var(--tv-track-tight)]"
          >
            {sidebarOpen ? (
              <PanelLeftClose size={16} />
            ) : (
              <PanelLeftOpen size={16} />
            )}
            {sidebarOpen ? "Hide" : "Show"} curriculum
          </button>

          {/* Video placeholder */}
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-card bg-black">
            <div className="flex flex-col items-center gap-3 text-white">
              <span className="flex h-16 w-16 items-center justify-center rounded-pill border-[1.5px] border-white">
                <Play size={26} className="ml-1" />
              </span>
              <span className="text-sm text-gray-400 [letter-spacing:var(--tv-track-tight)]">
                Video lesson · {current.duration}
              </span>
            </div>
          </div>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
            {current.module}
          </p>
          <h1 className="mt-2 text-[clamp(26px,4vw,34px)] font-bold leading-tight text-black [letter-spacing:var(--tv-track-tighter)]">
            {current.title}
          </h1>

          {/* Lesson body (placeholder editorial copy) */}
          <div className="mt-5 flex flex-col gap-4 text-[17px] leading-relaxed text-gray-700 [letter-spacing:var(--tv-track-tight)]">
            <p>
              In this lesson we cover the core ideas, step by step, in plain
              language. Watch the video first, then read through the notes below
              to lock it in.
            </p>
            <p>
              Take your time. You can rewatch any part, and you keep access for
              life. When you&apos;re ready, mark this lesson complete and move on.
            </p>
            <div className="rounded-sm border-l-[3px] border-black bg-gray-50 px-5 py-4 text-base text-gray-700">
              Tip: practice as you go. The work sticks faster when you build
              alongside the lesson.
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-6">
            <Button
              variant={completed[current.id] ? "outline" : "inverse"}
              onClick={markComplete}
              disabled={pending || completed[current.id]}
              iconLeft={<Check size={18} />}
            >
              {completed[current.id] ? "Completed" : "Mark complete"}
            </Button>
            {next && (
              <Button
                href={`/courses/${course.id}/lessons/${next.id}`}
                variant="text"
              >
                Next: {next.title} →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
