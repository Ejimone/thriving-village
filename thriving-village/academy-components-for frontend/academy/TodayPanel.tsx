"use client";

import { useState } from "react";
import {
  Play,
  FileText,
  Link2,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toaster";
import { getDay, isWeekEnd, weekOf } from "@/lib/cohort";

type Mode = "today" | "submitted" | "caught-up";

export function TodayPanel({
  day,
  courseId,
  mode,
  submittedUrl,
  earlyRequested,
  material,
  onSubmit,
  onRequestEarly,
}: {
  day: number;
  courseId: string;
  mode: Mode;
  submittedUrl?: string;
  earlyRequested?: boolean;
  material?: { text?: string; video?: string } | null;
  onSubmit: (url: string) => void;
  onRequestEarly?: () => void;
}) {
  const content = getDay(day, courseId);
  const [url, setUrl] = useState("");

  // Admin-authored material takes precedence over generated defaults.
  const notes = material?.text
    ? material.text.split(/\n\n+/).filter(Boolean)
    : content.material;
  const videoLink = material?.video;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Paste a link to your work first.");
      return;
    }
    onSubmit(trimmed);
    setUrl("");
    toast.success(
      isWeekEnd(day)
        ? "Submitted. You've finished this week's tasks."
        : "Submitted. Tomorrow is unlocked.",
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-gray-200 bg-white shadow-md">
      {/* Day heading */}
      <div className="flex items-baseline justify-between gap-4 border-b border-gray-200 px-6 py-5 sm:px-8">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
            {mode === "submitted"
              ? `Day ${day} · Reviewing`
              : mode === "caught-up"
                ? `Day ${day} · Done`
                : `Day ${day} · Today`}
          </p>
          <h1 className="mt-1 truncate text-[clamp(20px,3vw,26px)] font-bold leading-tight text-black [letter-spacing:var(--tv-track-tighter)]">
            {content.title}
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-8 px-6 py-7 sm:px-8">
        {/* 1. Video lesson */}
        <section>
          {videoLink ? (
            <a
              href={videoLink}
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
                  Video lesson · {content.videoDuration}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* 2. Written material / transcript */}
        <section>
          <SectionLabel icon={<FileText size={15} />}>Lesson notes</SectionLabel>
          <div className="mt-3 flex flex-col gap-4 text-[16px] leading-relaxed text-gray-700 [letter-spacing:var(--tv-track-tight)]">
            {notes.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* 3. Documentation links */}
        <section>
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

        {/* 4. Task */}
        <section className="rounded-sm border-l-[3px] border-black bg-gray-50 px-5 py-4">
          <SectionLabel>Today&apos;s task</SectionLabel>
          <p className="mt-2 text-[16px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
            {content.task}
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            {content.taskDetail}
          </p>
        </section>

        {/* 5. Submission */}
        <section className="border-t border-gray-200 pt-6">
          {mode === "today" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                label="Submit your work"
                placeholder="Paste a link — repo, deployed page, or file"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                inputMode="url"
              />
              <div>
                <Button type="submit" variant="inverse" iconRight={<ArrowRight size={18} />}>
                  Submit task
                </Button>
              </div>
            </form>
          )}

          {mode === "submitted" && (
            <div className="flex items-start gap-3 rounded-sm bg-gray-50 px-5 py-4">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                  Submitted
                </p>
                {submittedUrl && (
                  <a
                    href={submittedUrl}
                    className="mt-0.5 block truncate text-[14px] text-gray-500 underline-offset-4 hover:underline"
                  >
                    {submittedUrl}
                  </a>
                )}
              </div>
            </div>
          )}

          {mode === "caught-up" && (
            <div className="rounded-sm border border-gray-200 bg-white px-5 py-4">
              <div className="flex items-start gap-3">
                <CalendarClock size={18} className="mt-0.5 shrink-0 text-gray-500" />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                    You&apos;re all caught up
                  </p>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                    You&apos;ve finished Week {weekOf(day)}. Next week rolls out on
                    schedule — or, since you&apos;re ahead, ask your facilitator to
                    review your work and unlock it early.
                  </p>
                </div>
              </div>
              <div className="mt-4 pl-[30px]">
                {earlyRequested ? (
                  <span className="inline-flex items-center gap-2 rounded-pill bg-gray-100 px-3.5 py-2 text-[13px] font-semibold text-gray-600 [letter-spacing:var(--tv-track-tight)]">
                    <Clock size={14} /> Early access requested — waiting on your facilitator
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={onRequestEarly}>
                    Request early access
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
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
