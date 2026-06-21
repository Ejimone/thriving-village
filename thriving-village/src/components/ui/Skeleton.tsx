import React from "react";
import { cn } from "@/lib/utils";

/** Loading skeleton block. Uses the neutral shimmer from globals.css. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("tv-skeleton rounded-sm", className)} style={style} />;
}

/** A card-shaped skeleton row matching the job/course list density. */
export function SkeletonListRow() {
  return (
    <div className="bg-white border border-gray-200 rounded-card px-6 py-5 flex items-center gap-5">
      <div className="flex-1 flex flex-col gap-2.5">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-20 rounded-pill" />
    </div>
  );
}

/** A grid card skeleton matching contest/course cards. */
export function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-card overflow-hidden">
      <Skeleton className="h-[150px] w-full rounded-none" />
      <div className="p-6 flex flex-col gap-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
