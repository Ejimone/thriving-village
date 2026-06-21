import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { JobCard } from "@/components/cards/JobCard";
import { JobFilters } from "@/components/cards/JobFilters";
import { getJobs, getSavedJobSlugs, type Field, type LocationType, type ExperienceLevel } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;

  const [{ items: jobs, total, pageCount }, session] = await Promise.all([
    getJobs({
      field: params.field as Field | undefined,
      locationType: params.location as LocationType | undefined,
      level: params.level as ExperienceLevel | undefined,
      query: params.query,
      page,
    }),
    getSession(),
  ]);

  const savedSlugs = session ? await getSavedJobSlugs(session.jwt) : new Set<string>();

  const hrefForPage = (p: number) => {
    const next = new URLSearchParams(params as Record<string, string>);
    next.set("page", String(p));
    return `/jobs?${next.toString()}`;
  };

  return (
    <div className="tv-container pt-14">
      <h1 className="text-[clamp(36px,6vw,48px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
        Ready to work
      </h1>
      <p className="mt-3 text-[19px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        Real roles from our sister businesses and partners.
      </p>

      <JobFilters total={total} />

      <div className="mt-6 flex flex-col gap-3 pb-4">
        {jobs.length > 0 ? (
          jobs.map((j) => <JobCard key={j.id} job={j} initialSaved={savedSlugs.has(j.id)} />)
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

      <Pagination page={page} pageCount={pageCount} hrefForPage={hrefForPage} />
    </div>
  );
}
