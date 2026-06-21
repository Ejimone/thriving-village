import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function ContestsLoading() {
  return (
    <div>
      <div className="bg-gray-150">
        <div className="tv-container py-16">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="mt-4 h-16 w-full max-w-[760px]" />
          <Skeleton className="mt-4 h-6 w-full max-w-[560px]" />
        </div>
      </div>
      <div className="tv-container pt-14">
        <Skeleton className="h-9 w-40" />
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
