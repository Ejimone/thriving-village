import { GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { CourseCard } from "@/components/cards/CourseCard";
import { CourseFilters } from "@/components/cards/CourseFilters";
import {
  getCourses,
  type Field,
  type CourseDelivery,
  type CourseKind,
  type ExperienceLevel,
  type PriceBand,
} from "@/lib/data";

const COURSE_ACCENT = "var(--tv-accent-yellow)";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;

  const { items: courses, total, pageCount } = await getCourses({
    field: params.field as Field | undefined,
    delivery: params.delivery as CourseDelivery | undefined,
    kind: params.kind as CourseKind | undefined,
    level: params.level as ExperienceLevel | undefined,
    price: params.price as PriceBand | undefined,
    page,
  });

  const hrefForPage = (p: number) => {
    const next = new URLSearchParams(params as Record<string, string>);
    next.set("page", String(p));
    return `/courses?${next.toString()}`;
  };

  return (
    <div className="tv-container pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(36px,6vw,48px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
            Learn the{" "}
            <span className="rounded px-2" style={{ background: COURSE_ACCENT }}>
              craft
            </span>
          </h1>
          <p className="mt-3 text-[19px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            From short courses to certifications — online or onsite, in every
            field we serve.
          </p>
        </div>
      </div>

      <CourseFilters total={total} />

      <div className="mt-6 grid gap-5 pb-4 md:grid-cols-2">
        {courses.length > 0 ? (
          courses.map((c) => <CourseCard key={c.id} course={c} />)
        ) : (
          <div className="md:col-span-2">
            <EmptyState
              icon={<GraduationCap size={22} />}
              title="No courses match your filters yet"
              body="Try widening your search or clearing a filter — we add courses often."
              action={
                <Button variant="outline" href="/courses">
                  Clear filters
                </Button>
              }
            />
          </div>
        )}
      </div>

      <Pagination page={page} pageCount={pageCount} hrefForPage={hrefForPage} />
    </div>
  );
}
