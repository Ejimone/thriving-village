import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { JobCard } from "@/components/cards/JobCard";
import {
  MY_COURSES,
  MY_APPLICATIONS,
  MY_ENTRIES,
  JOBS,
  getCourse,
  getJob,
  getContest,
  naira,
  prizePool,
  WHATSAPP_URL,
} from "@/lib/data";

export default function DashboardOverview() {
  const inProgress = MY_COURSES.filter((c) => c.progress < 100);
  const recommended = JOBS.slice(3, 5);

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome */}
      <div>
        <h1 className="text-[clamp(28px,4vw,36px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
          Welcome back, Ada
        </h1>
        <p className="mt-2 text-[17px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
          Here&apos;s where you left off.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Courses in progress" value={String(inProgress.length)} href="/dashboard/courses" />
        <StatTile label="Open applications" value={String(MY_APPLICATIONS.filter((a) => a.status !== "Closed").length)} href="/dashboard/applications" />
        <StatTile label="Contest entries" value={String(MY_ENTRIES.length)} href="/dashboard/contests" />
      </div>

      {/* In-progress courses */}
      <Section title="Keep learning" href="/dashboard/courses" linkLabel="My courses">
        <div className="grid gap-4 sm:grid-cols-2">
          {inProgress.map((mc) => {
            const course = getCourse(mc.courseId)!;
            return (
              <Card key={mc.courseId} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Badge tone="neutral" size="sm">
                    {course.field}
                  </Badge>
                </div>
                <h3 className="text-[18px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                  {course.title}
                </h3>
                <ProgressBar value={mc.progress} showLabel />
                <Button
                  href={`/courses/${course.id}/lessons/${course.modules[0].lessons[0].id}`}
                  variant="outline"
                  size="sm"
                >
                  Continue
                </Button>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Applications snapshot */}
      <Section title="Your applications" href="/dashboard/applications" linkLabel="All applications">
        <Card variant="flat" className="divide-y divide-gray-200 !p-0">
          {MY_APPLICATIONS.slice(0, 3).map((a) => {
            const job = getJob(a.jobId)!;
            return (
              <div key={a.jobId} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)] hover:underline"
                  >
                    {job.title}
                  </Link>
                  <p className="text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                    {job.org} · {a.appliedAgo}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            );
          })}
        </Card>
      </Section>

      {/* Contest entries snapshot */}
      <Section title="Your contest entries" href="/dashboard/contests" linkLabel="All entries">
        <Card variant="flat" className="divide-y divide-gray-200 !p-0">
          {MY_ENTRIES.map((e) => {
            const contest = getContest(e.contestId)!;
            return (
              <div key={e.contestId} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/contests/${contest.id}`}
                    className="text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)] hover:underline"
                  >
                    {contest.title}
                  </Link>
                  <p className="text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                    {naira(prizePool(contest))} pool · {e.submittedAgo}
                  </p>
                </div>
                <StatusBadge status={e.status} />
              </div>
            );
          })}
        </Card>
      </Section>

      {/* Recommended */}
      <Section title="Recommended for you" href="/jobs" linkLabel="All jobs">
        <div className="flex flex-col gap-3">
          {recommended.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      </Section>

      {/* WhatsApp nudge */}
      <Card variant="inverse" className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[18px] font-bold [letter-spacing:var(--tv-track-tight)]">
            Stay close to the community
          </p>
          <p className="text-[15px] text-gray-300 [letter-spacing:var(--tv-track-tight)]">
            Jobs, contests, and support — it all happens on WhatsApp.
          </p>
        </div>
        <Button
          href={WHATSAPP_URL}
          variant="inverse"
          iconLeft={<MessageCircle size={18} />}
          className="!bg-white !text-black !border-white hover:!bg-gray-100"
        >
          Open WhatsApp
        </Button>
      </Card>
    </div>
  );
}

function StatTile({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-gray-300">
        <p className="text-[32px] font-bold leading-none text-black [letter-spacing:var(--tv-track-tighter)]">
          {value}
        </p>
        <p className="mt-2 text-[14px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          {label}
        </p>
      </Card>
    </Link>
  );
}

function Section({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-[22px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
          {title}
        </h2>
        <Button href={href} variant="text" size="sm">
          {linkLabel} <ArrowRight size={15} className="ml-1" />
        </Button>
      </div>
      {children}
    </div>
  );
}
