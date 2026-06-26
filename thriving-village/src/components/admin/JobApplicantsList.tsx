"use client";

import { useState, useTransition } from "react";
import { Users, FileText, Link2, Video } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toaster";
import { updateApplicationStatusAction } from "@/lib/actions/admin";
import type { ApplicationStatus, JobApplicant } from "@/lib/data";

function formatSize(bytes: number): string {
  if (!bytes) return "";
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function ApplicantCard({ applicant }: { applicant: JobApplicant }) {
  const [status, setStatus] = useState(applicant.status);
  const [pending, startTransition] = useTransition();

  function setStatusOptimistic(next: ApplicationStatus) {
    const prev = status;
    if (prev === next) return;
    setStatus(next);
    startTransition(async () => {
      const result = await updateApplicationStatusAction(applicant.documentId, next);
      if (result.error) {
        setStatus(prev);
        toast.error(result.error);
      } else {
        toast.success(`Marked as ${next}.`);
      }
    });
  }

  return (
    <Card variant="flat" className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-1 gap-4">
        <Avatar name={applicant.name} size={44} />
        <div className="flex flex-col gap-2 min-w-0">
          <div>
            <p className="text-[16px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
              {applicant.name}
            </p>
            <p className="text-[14px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
              {applicant.whatsapp} · Applied {applicant.appliedAgo}
            </p>
          </div>

          {applicant.message && (
            <p className="text-[14px] text-gray-700 [letter-spacing:var(--tv-track-tight)]">
              {applicant.message}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-[13px] [letter-spacing:var(--tv-track-tight)]">
            {applicant.videoUrl && (
              <a
                href={applicant.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-black hover:underline"
              >
                <Video size={14} /> Intro video
              </a>
            )}
            {applicant.portfolioUrl && (
              <a
                href={applicant.portfolioUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-black hover:underline"
              >
                <Link2 size={14} /> Portfolio
              </a>
            )}
            {applicant.cv && (
              <a
                href={applicant.cv.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-black hover:underline"
              >
                <FileText size={14} /> CV{applicant.cv.size ? ` (${formatSize(applicant.cv.size)})` : ""}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2.5">
        <StatusBadge status={status} />
        <div className="flex gap-2">
          <Button
            variant={status === "Shortlisted" ? "inverse" : "outline"}
            size="sm"
            disabled={pending}
            onClick={() => setStatusOptimistic("Shortlisted")}
          >
            Shortlist
          </Button>
          <Button
            variant={status === "Archived" ? "inverse" : "outline"}
            size="sm"
            disabled={pending}
            onClick={() => setStatusOptimistic("Archived")}
          >
            Archive
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function JobApplicantsList({ applicants }: { applicants: JobApplicant[] }) {
  if (applicants.length === 0) {
    return (
      <EmptyState
        icon={<Users size={22} />}
        title="No applicants yet"
        body="Applications will show up here as soon as someone applies."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {applicants.map((a) => (
        <ApplicantCard key={a.documentId} applicant={a} />
      ))}
    </div>
  );
}
