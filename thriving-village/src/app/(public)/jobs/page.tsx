import { Pagination } from "@/components/ui/Pagination";
import { LiveJobList } from "@/components/cards/LiveJobList";
import { getJobs, type Field, type LocationType, type ExperienceLevel } from "@/lib/data";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const field = params.field as Field | undefined;
  const locationType = params.location as LocationType | undefined;
  const level = params.level as ExperienceLevel | undefined;
  const query = params.query;

  const { items: jobs, total, pageCount } = await getJobs({ field, locationType, level, query, page });

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

      <LiveJobList
        initialJobs={jobs}
        initialTotal={total}
        page={page}
        filters={{ field, locationType, level, query }}
      />

      <Pagination page={page} pageCount={pageCount} hrefForPage={hrefForPage} />
    </div>
  );
}
