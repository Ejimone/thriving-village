"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { toggleSavedJobAction } from "@/lib/actions/saved-jobs";
import type { Job } from "@/lib/data";

/**
 * Reusable job row. Used on the job board and the dashboard. The parent page
 * never reads the session server-side (so the page stays cacheable across all
 * visitors); this self-hydrates the saved state after mount instead.
 */
export function JobCard({ job, initialSaved = false }: { job: Job; initialSaved?: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const touchedRef = useRef(false);

  useEffect(() => {
    fetch("/api/me/saved-jobs")
      .then((res) => res.json())
      .then((data: { slugs: string[] }) => {
        if (touchedRef.current) return;
        if (data.slugs.includes(job.id)) setSaved(true);
      })
      .catch(() => {});
  }, [job.id]);

  function toggleSave() {
    touchedRef.current = true;
    const next = !saved;
    setSaved(next); // optimistic
    startTransition(async () => {
      const result = await toggleSavedJobAction(job.id, next);
      if (result.error) {
        setSaved(!next); // roll back
        toast.error(result.error);
      }
    });
  }

  return (
    <Card
      variant="flat"
      className="flex flex-col gap-4 px-6 py-5 transition-colors hover:border-gray-300 sm:flex-row sm:items-center sm:gap-5"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href={`/jobs/${job.id}`}
            className="text-[19px] font-semibold text-black [letter-spacing:var(--tv-track-tight)] hover:underline"
          >
            {job.title}
          </Link>
          <Badge tone="neutral" size="sm">
            {job.field}
          </Badge>
          <Badge tone="outline" size="sm">
            {job.level}
          </Badge>
        </div>
        <p className="mt-1.5 text-[15px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          {job.org} · {job.location} · {job.type}
        </p>
      </div>

      <span className="text-[15px] font-semibold text-gray-800 whitespace-nowrap [letter-spacing:var(--tv-track-tight)]">
        {job.pay}
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={saved ? "Saved" : "Save job"}
          onClick={toggleSave}
          disabled={pending}
          className={`p-1.5 ${saved ? "text-black" : "text-gray-400 hover:text-black"}`}
        >
          {saved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
        </button>
        <Button href={`/jobs/${job.id}`} variant="inverse" size="sm">
          View
        </Button>
      </div>
    </Card>
  );
}
