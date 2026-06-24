"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MonitorPlay,
  MessageCircle,
  CalendarClock,
  ArrowLeft,
  Video,
  Mail,
  Phone,
} from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DayStrip } from "@/components/academy/DayStrip";
import { TodayPanel } from "@/components/academy/TodayPanel";
import { useCohort, FRONTEND_ID } from "@/components/academy/CohortProvider";
import { toast } from "@/components/ui/Toaster";
import {
  COMMUNITY,
  GROUP_ASSIGNMENT,
  ME,
  ME_STUDENT_ID,
  SESSIONS,
  getEnrollment,
  getStudent,
  studentEmail,
  studentWhatsapp,
  whatsappLink,
} from "@/lib/cohort";

export default function DayView({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const { course, submitToday, requestEarlyAccess, teamOf, getMaterial } = useCohort();

  if (!getEnrollment(courseId)) notFound();

  // Teammates for the group assignment (frontend cohort) — name/email/WhatsApp only.
  const teammates =
    courseId === FRONTEND_ID
      ? (teamOf(ME_STUDENT_ID) ?? []).map(getStudent).filter(Boolean)
      : [];

  const c = course(courseId);
  const { currentDay, enrollment, isSubmitted, isCaughtUp, earlyRequested, progressPct } = c;

  const [picked, setPicked] = useState<number | null>(null);
  const [urls, setUrls] = useState<Record<number, string>>({});

  const effectiveSelected = Math.min(picked ?? currentDay, currentDay);

  const mode =
    effectiveSelected === currentDay && isCaughtUp
      ? "caught-up"
      : effectiveSelected === currentDay && !isSubmitted(currentDay)
        ? "today"
        : "submitted";

  const submittedUrl =
    urls[effectiveSelected] ??
    (isSubmitted(effectiveSelected)
      ? `https://example.com/${ME.name.split(" ")[0].toLowerCase()}/day-${effectiveSelected}`
      : undefined);

  function handleSubmit(url: string) {
    setUrls((u) => ({ ...u, [currentDay]: url }));
    submitToday(courseId);
    setPicked(null);
  }

  function handleRequestEarly() {
    requestEarlyAccess(courseId);
    toast.success("Early access requested. Your facilitator will review your work.");
  }

  const upcoming = SESSIONS.slice(0, 3);

  return (
    <div className="tv-container py-8">
      <div className="mx-auto max-w-[1080px]">
        <Link
          href="/academy/student"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-black [letter-spacing:var(--tv-track-tight)]"
        >
          <ArrowLeft size={16} /> My courses
        </Link>

        {/* Minimal chrome: course name + progress */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
              {enrollment.category} · {enrollment.cohortName}
            </p>
            <h1 className="mt-1 font-serif text-[clamp(24px,4vw,32px)] leading-tight text-black">
              {enrollment.title}
            </h1>
          </div>
          <div className="w-full sm:max-w-[280px]">
            <div className="mb-1.5 flex items-center justify-between text-[13px] text-gray-500">
              <span>Your progress</span>
              <span className="font-semibold text-black tabular-nums">
                Day {currentDay} of {enrollment.daysTotal}
              </span>
            </div>
            <ProgressBar value={progressPct} />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Main column: strip + today's work */}
          <div className="flex flex-col gap-6">
            <DayStrip
              currentDay={currentDay}
              selectedDay={effectiveSelected}
              daysTotal={enrollment.daysTotal}
              weeksTotal={enrollment.weeksTotal}
              isSubmitted={isSubmitted}
              onSelect={(d) => setPicked(d)}
            />
            <TodayPanel
              day={effectiveSelected}
              courseId={courseId}
              mode={mode}
              submittedUrl={submittedUrl}
              earlyRequested={earlyRequested}
              material={getMaterial(courseId, effectiveSelected)}
              onSubmit={handleSubmit}
              onRequestEarly={handleRequestEarly}
            />
          </div>

          {/* Side rail: team + upcoming calls + community */}
          <aside className="flex flex-col gap-6">
            {teammates.length > 0 && (
              <RailCard title="Your team">
                <p className="mb-3 text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                  {GROUP_ASSIGNMENT.title}. Reach out to set up your group.
                </p>
                <ul className="flex flex-col gap-3.5">
                  {teammates.map((t) => (
                    <li key={t!.id} className="flex flex-col gap-0.5">
                      <span className="text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                        {t!.name}
                      </span>
                      <a
                        href={`mailto:${studentEmail(t!)}`}
                        className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 underline-offset-4 hover:text-black hover:underline"
                      >
                        <Mail size={11} className="shrink-0 text-gray-400" />
                        {studentEmail(t!)}
                      </a>
                      <a
                        href={whatsappLink(t!)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 underline-offset-4 hover:text-black hover:underline"
                      >
                        <Phone size={11} className="shrink-0 text-gray-400" />
                        {studentWhatsapp(t!)}
                      </a>
                    </li>
                  ))}
                </ul>
              </RailCard>
            )}

            <RailCard title="Upcoming live">
              <ul className="flex flex-col gap-3.5">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex gap-3">
                    <CalendarClock size={16} className="mt-0.5 shrink-0 text-gray-400" />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                        {s.title}
                      </p>
                      <p className="text-[13px] text-gray-500">
                        {s.day} · {s.time}
                      </p>
                      {s.link && (
                        <a
                          href={s.link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-black underline-offset-4 hover:underline [letter-spacing:var(--tv-track-tight)]"
                        >
                          <Video size={13} /> Join
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </RailCard>

            <RailCard title="Community">
              <div className="flex flex-col gap-2.5">
                <RailLink href={COMMUNITY.whatsapp} icon={<MessageCircle size={16} />}>
                  Cohort WhatsApp
                </RailLink>
                <RailLink href={COMMUNITY.youtube} icon={<MonitorPlay size={16} />}>
                  YouTube channel
                </RailLink>
              </div>
            </RailCard>
          </aside>
        </div>
      </div>
    </div>
  );
}

function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function RailLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2.5 text-[14px] font-medium text-black transition-colors hover:text-gray-600 [letter-spacing:var(--tv-track-tight)]"
    >
      <span className="text-gray-400">{icon}</span>
      {children}
    </a>
  );
}
