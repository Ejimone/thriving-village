import Link from "next/link";
import { Briefcase } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MY_APPLICATIONS, getJob } from "@/lib/data";

export default function MyApplicationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[clamp(26px,4vw,32px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
          My applications
        </h1>
        <p className="mt-2 text-[16px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
          Track where each role stands. Updates also come through WhatsApp.
        </p>
      </div>

      {MY_APPLICATIONS.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={22} />}
          title="No applications yet"
          body="When you apply to roles, you'll track their status here."
          action={
            <Button href="/jobs" variant="inverse">
              Browse jobs
            </Button>
          }
        />
      ) : (
        <Card variant="flat" className="divide-y divide-gray-200 !p-0">
          {MY_APPLICATIONS.map((a) => {
            const job = getJob(a.jobId)!;
            return (
              <div
                key={a.jobId}
                className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:gap-5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="text-[17px] font-semibold text-black [letter-spacing:var(--tv-track-tight)] hover:underline"
                    >
                      {job.title}
                    </Link>
                    <Badge tone="neutral" size="sm">
                      {job.field}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[14px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                    {job.org} · {job.location} · applied {a.appliedAgo}
                  </p>
                </div>
                <StatusBadge status={a.status} />
                <Button href={`/jobs/${job.id}`} variant="outline" size="sm">
                  View role
                </Button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
