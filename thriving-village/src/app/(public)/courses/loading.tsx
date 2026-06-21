import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function CoursesLoading() {
  return (
    <div className="tv-container pt-14">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      <div className="mt-7 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-pill" />
        ))}
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
