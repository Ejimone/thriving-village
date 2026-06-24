"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Play,
  FileText,
  Link2,
  ClipboardList,
  ExternalLink,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useCohort } from "@/components/academy/CohortProvider";
import { facilitatorCourses, getDay, weekOf } from "@/lib/cohort";

export default function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; day: string }>;
}) {
  const { courseId, day: dayStr } = use(params);
  const { getMaterial } = useCohort();

  const courseMeta = facilitatorCourses().find((c) => c.courseId === courseId);
  const day = parseInt(dayStr, 10);
  if (!courseMeta || !day || day < 1 || day > courseMeta.weeksTotal * 7) notFound();

  const content = getDay(day, courseId);
  const material = getMaterial(courseId, day);
  const notes = material?.text ? material.text.split(/\n\n+/).filter(Boolean) : content.material;

  return (
    <div className="mx-auto max-w-[760px]">
      <Link
        href="/academy/facilitator/course"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-black [letter-spacing:var(--tv-track-tight)]"
      >
        <ArrowLeft size={16} /> Course manager
      </Link>

      <div className="mb-4 flex items-center gap-2">
        <Badge tone="neutral" size="sm">{courseMeta.title}</Badge>
        <Badge tone="outline" size="sm">Week {weekOf(day)} · Day {day}</Badge>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-400">
          <Lock size={12} /> View only
        </span>
      </div>

      <h1 className="text-[clamp(24px,4vw,32px)] font-bold leading-tight text-black [letter-spacing:var(--tv-track-tighter)]">
        {content.title}
      </h1>

      {/* Video */}
      <section className="mt-6">
        {material?.video ? (
          <a
            href={material.video}
            target="_blank"
            rel="noreferrer"
            className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-card bg-black"
          >
            <div className="flex flex-col items-center gap-3 text-white">
              <span className="flex h-16 w-16 items-center justify-center rounded-pill border-[1.5px] border-white transition-transform group-hover:scale-105">
                <Play size={26} className="ml-1" />
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-300 [letter-spacing:var(--tv-track-tight)]">
                Watch lesson · {content.videoDuration}
                <ExternalLink size={13} />
              </span>
            </div>
          </a>
        ) : (
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-card bg-black">
            <div className="flex flex-col items-center gap-3 text-white">
              <span className="flex h-16 w-16 items-center justify-center rounded-pill border-[1.5px] border-white">
                <Play size={26} className="ml-1" />
              </span>
              <span className="text-sm text-gray-400 [letter-spacing:var(--tv-track-tight)]">
                No video added · {content.videoDuration}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Lesson notes */}
      <section className="mt-7">
        <SectionLabel icon={<FileText size={15} />}>Lesson notes</SectionLabel>
        <div className="mt-3 flex flex-col gap-4 text-[16px] leading-relaxed text-gray-700 [letter-spacing:var(--tv-track-tight)]">
          {notes.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {!material?.text && (
            <p className="text-[13px] text-gray-400">
              Default outline shown — no material has been added by admin yet.
            </p>
          )}
        </div>
      </section>

      {/* Documentation */}
      <section className="mt-7">
        <SectionLabel icon={<Link2 size={15} />}>Documentation</SectionLabel>
        <ul className="mt-3 flex flex-col gap-1.5">
          {content.docs.map((d) => (
            <li key={d.label}>
              <a
                href={d.href}
                className="inline-flex items-center gap-2 text-[15px] font-medium text-black underline-offset-4 hover:underline [letter-spacing:var(--tv-track-tight)]"
              >
                {d.label}
                <ExternalLink size={13} className="text-gray-400" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Task */}
      <section className="mt-7 rounded-sm border-l-[3px] border-black bg-gray-50 px-5 py-4">
        <SectionLabel icon={<ClipboardList size={15} />}>Task</SectionLabel>
        <p className="mt-2 text-[16px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
          {content.task}
        </p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600 [letter-spacing:var(--tv-track-tight)]">
          {content.taskDetail}
        </p>
      </section>
    </div>
  );
}

function SectionLabel({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
      {icon}
      {children}
    </span>
  );
}
