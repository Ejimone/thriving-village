"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tag } from "@/components/ui/Tag";
import type { BrandKind } from "@/lib/data";

const FILTERS: { label: string; value: BrandKind | "All" }[] = [
  { label: "All", value: "All" },
  { label: "Our brands", value: "Sister business" },
  { label: "Partners", value: "Partner" },
];

export function BrandFilters({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const kind = (searchParams.get("kind") as BrandKind | null) ?? "All";

  function setKind(value: BrandKind | "All") {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "All") params.delete("kind");
    else params.set("kind", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mt-7 flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => (
        <Tag key={f.value} selected={kind === f.value} onClick={() => setKind(f.value)}>
          {f.label}
        </Tag>
      ))}
      <span className="ml-auto text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
        {total} {total === 1 ? "brand" : "brands"}
      </span>
    </div>
  );
}
