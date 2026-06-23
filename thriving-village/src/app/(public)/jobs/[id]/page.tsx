import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Clock,
  Building2,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ApplyDialog } from "@/components/cards/ApplyDialog";
import { getJob, getMyApplications } from "@/lib/data";
import { getSession } from "@/lib/session";
import { applyToJobAction } from "@/lib/actions/applications";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [job, session] = await Promise.all([getJob(id), getSession()]);
  if (!job) notFound();

  const myApplications = session ? await getMyApplications(session.jwt) : [];
  const myApplication = myApplications.find((a) => a.jobId === job.id);

  const meta = [
    { icon: <Building2 size={16} />, text: `${job.org} · ${job.orgKind}` },
    { icon: <MapPin size={16} />, text: `${job.location} · ${job.locationType}` },
    { icon: <Briefcase size={16} />, text: `${job.type} · ${job.level}` },
    { icon: <Clock size={16} />, text: `Posted ${job.postedAgo}` },
  ];

  return (
    <div className="tv-container pt-10 pb-4">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black [letter-spacing:var(--tv-track-tight)]"
      >
        <ArrowLeft size={16} /> All jobs
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main */}
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="neutral" size="md">
              {job.field}
            </Badge>
            <Badge tone="outline" size="md">
              {job.level}
            </Badge>
          </div>
          <h1 className="mt-4 text-[clamp(32px,5vw,44px)] font-bold leading-[1.05] text-black [letter-spacing:var(--tv-track-tighter)]">
            {job.title}
          </h1>
          <p className="mt-4 max-w-[640px] text-[19px] leading-snug text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            {job.summary}
          </p>

          <div className="mt-8 flex flex-col gap-8">
            <Section title="What you'll do" items={job.responsibilities} />
            <Section title="What we're looking for" items={job.requirements} />
          </div>

          <Card className="mt-10 flex items-center gap-4">
            <Avatar name={job.org} size={52} />
            <div>
              <p className="text-[17px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                {job.org}
              </p>
              <p className="text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                {job.orgKind} · hiring through Thriving Village
              </p>
            </div>
          </Card>
        </div>

        {/* Sticky apply rail */}
        <aside className="lg:sticky lg:top-[88px] lg:self-start">
          <Card className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                Pay
              </p>
              <p className="text-2xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
                {job.pay}
              </p>
            </div>
            <div className="flex flex-col gap-2.5 border-t border-gray-200 pt-4">
              {meta.map((m) => (
                <div
                  key={m.text}
                  className="flex items-center gap-2.5 text-[15px] text-gray-700 [letter-spacing:var(--tv-track-tight)]"
                >
                  <span className="text-gray-400">{m.icon}</span>
                  {m.text}
                </div>
              ))}
            </div>
            {myApplication ? (
              <>
                <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                  <span className="text-[15px] font-medium text-black [letter-spacing:var(--tv-track-tight)]">
                    You&apos;ve applied
                  </span>
                  <StatusBadge status={myApplication.status} />
                </div>
                <p className="text-center text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                  Updates come through WhatsApp.
                </p>
              </>
            ) : (
              <ApplyDialog
                fullWidth
                label="Apply for this role"
                title={`Apply — ${job.title}`}
                subtitle={`${job.org} · ${job.location}`}
                promptLabel="Why are you a good fit? (optional)"
                withFile
                fileHint="Attach your CV — PDF or image"
                withPortfolioUrl
                successMessage="Application sent. We'll be in touch on WhatsApp."
                action={applyToJobAction.bind(null, job.id)}
              />
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
        {title}
      </h2>
      <ul className="mt-3 flex flex-col gap-2.5">
        {items.map((it) => (
          <li
            key={it}
            className="flex items-start gap-3 text-base text-gray-700 [letter-spacing:var(--tv-track-tight)]"
          >
            <Check size={18} className="mt-0.5 flex-none text-black" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
