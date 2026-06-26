"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ApplyDialog } from "@/components/cards/ApplyDialog";
import { applyToJobAction } from "@/lib/actions/applications";
import type { ApplicationStatus, Job } from "@/lib/data";

type Application = { status: ApplicationStatus; appliedAgo: string };

/**
 * Switches between the apply button and the "You've applied" status — optimistic
 * on submit. The page never reads the session server-side (so it stays cacheable
 * across all visitors); this self-hydrates the per-user state after mount instead.
 */
export function JobApplyPanel({
  job,
  initialApplication,
}: {
  job: Job;
  initialApplication: Application | null;
}) {
  const [application, setApplication] = useState(initialApplication);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/applications")
      .then((res) => res.json())
      .then((data: { applications: { jobId: string; status: ApplicationStatus; appliedAgo: string }[] }) => {
        if (cancelled || hydrated) return;
        const mine = data.applications.find((a) => a.jobId === job.id);
        if (mine) setApplication({ status: mine.status, appliedAgo: mine.appliedAgo });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [job.id, hydrated]);

  if (application) {
    return (
      <>
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <span className="text-[15px] font-medium text-black [letter-spacing:var(--tv-track-tight)]">
            You&apos;ve applied
          </span>
          <StatusBadge status={application.status} />
        </div>
        <p className="text-center text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          Updates come through WhatsApp.
        </p>
      </>
    );
  }

  return (
    <ApplyDialog
      fullWidth
      label="Apply for this role"
      title={`Apply — ${job.title}`}
      subtitle={`${job.org} · ${job.location}`}
      withPrompt={false}
      withVideoUrl
      withFile
      fileHint="Attach your CV — PDF or image"
      withPortfolioUrl
      successMessage="Application sent. We'll be in touch on WhatsApp."
      action={applyToJobAction.bind(null, job.id)}
      onOptimisticSuccess={() => {
        setHydrated(true);
        setApplication({ status: "Applied", appliedAgo: "just now" });
      }}
      onOptimisticError={() => {
        setHydrated(true);
        setApplication(null);
      }}
    />
  );
}
