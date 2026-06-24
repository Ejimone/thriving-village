"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { JobCard } from "@/components/cards/JobCard";
import { JobFilters } from "@/components/cards/JobFilters";
import type { Job, Field, LocationType, ExperienceLevel } from "@/lib/data";

type LiveJobPayload = {
  id: string;
  title: string;
  org: string;
  orgKind: string;
  field: Field;
  location: string;
  locationType: LocationType;
  type: Job["type"];
  level: ExperienceLevel;
  pay: string;
  postedAgo: string;
};

type Filters = {
  field?: Field;
  locationType?: LocationType;
  level?: ExperienceLevel;
  query?: string;
};

function matchesFilters(job: LiveJobPayload, filters: Filters): boolean {
  if (filters.field && job.field !== filters.field) return false;
  if (filters.locationType && job.locationType !== filters.locationType) return false;
  if (filters.level && job.level !== filters.level) return false;
  if (filters.query) {
    const q = filters.query.toLowerCase();
    if (!job.title.toLowerCase().includes(q) && !job.org.toLowerCase().includes(q)) return false;
  }
  return true;
}

function toJob(payload: LiveJobPayload): Job {
  return { ...payload, documentId: "", summary: "", responsibilities: [], requirements: [] };
}

/**
 * Seeds from the server-rendered (cached) page, then live-inserts newly published jobs
 * via SSE — no polling, no reload. A job only slides into the visible list when it matches
 * the visitor's current filters and they're on page 1 (anywhere else, ordering wouldn't make
 * sense); otherwise it just bumps a "new jobs" pill that resets to page 1 on click.
 */
export function LiveJobList({
  initialJobs,
  initialTotal,
  page,
  filters,
}: {
  initialJobs: Job[];
  initialTotal: number;
  page: number;
  filters: Filters;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [total, setTotal] = useState(initialTotal);
  const [newCount, setNewCount] = useState(0);
  const [justArrivedId, setJustArrivedId] = useState<string | null>(null);
  const [savedSlugs, setSavedSlugs] = useState<Set<string>>(new Set());

  // One fetch for the whole page, not one per card — `key`s below force the
  // small set of affected cards to remount (cheap, leaf components) once this
  // resolves, since `JobCard`'s `initialSaved` is only read on its own mount.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/saved-jobs")
      .then((res) => res.json())
      .then((data: { slugs: string[] }) => {
        if (!cancelled) setSavedSlugs(new Set(data.slugs));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/jobs/stream");

    source.addEventListener("job.created", (event) => {
      const payload = JSON.parse(event.data) as LiveJobPayload;

      if (page === 1 && matchesFilters(payload, filters)) {
        setJobs((prev) => (prev.some((j) => j.id === payload.id) ? prev : [toJob(payload), ...prev]));
        setTotal((t) => t + 1);
        setJustArrivedId(payload.id);
        setTimeout(() => setJustArrivedId((id) => (id === payload.id ? null : id)), 4000);
      } else {
        setNewCount((n) => n + 1);
      }
    });

    return () => source.close();
  }, [page, filters]);

  return (
    <>
      <JobFilters total={total} />

      {newCount > 0 && (
        <button
          type="button"
          onClick={() => router.push("/jobs")}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-[color:var(--tv-accent-green)]/10 px-4 py-2.5 text-[14px] font-medium text-black transition-colors hover:bg-[color:var(--tv-accent-green)]/20 [letter-spacing:var(--tv-track-tight)]"
        >
          <Sparkles size={16} />
          {newCount} new {newCount === 1 ? "job" : "jobs"} posted — view
        </button>
      )}

      <div className="mt-6 flex flex-col gap-3 pb-4">
        {jobs.length > 0 ? (
          jobs.map((j) => (
            <div
              key={`${j.id}:${savedSlugs.has(j.id)}`}
              className={`rounded-lg transition-colors duration-700 ${
                j.id === justArrivedId ? "bg-[color:var(--tv-accent-yellow)]/10" : ""
              }`}
            >
              <JobCard job={j} initialSaved={savedSlugs.has(j.id)} />
            </div>
          ))
        ) : (
          <EmptyState
            icon={<Briefcase size={22} />}
            title="No jobs match your filters yet"
            body="Try widening your search or clearing a filter — new roles are posted often."
            action={
              <Button variant="outline" href="/jobs">
                Clear filters
              </Button>
            }
          />
        )}
      </div>
    </>
  );
}
