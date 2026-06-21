"use client";

import { useMemo, useState } from "react";
import { Tag } from "@/components/ui/Tag";
import { BrandCard } from "@/components/cards/BrandCard";
import { BRANDS, type BrandKind } from "@/lib/data";

const FILTERS: { label: string; value: BrandKind | "All" }[] = [
  { label: "All", value: "All" },
  { label: "Our brands", value: "Sister business" },
  { label: "Partners", value: "Partner" },
];

export default function BrandsPage() {
  const [kind, setKind] = useState<BrandKind | "All">("All");

  const list = useMemo(
    () => BRANDS.filter((b) => kind === "All" || b.kind === kind),
    [kind],
  );

  return (
    <div className="tv-container pt-14">
      <h1 className="text-[clamp(36px,6vw,48px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
        Brands
      </h1>
      <p className="mt-3 max-w-[620px] text-[19px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        The businesses and partners in our world — the people building, hiring,
        and growing alongside our community.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Tag
            key={f.value}
            selected={kind === f.value}
            onClick={() => setKind(f.value)}
          >
            {f.label}
          </Tag>
        ))}
        <span className="ml-auto text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          {list.length} {list.length === 1 ? "brand" : "brands"}
        </span>
      </div>

      <div className="mt-6 grid gap-5 pb-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((b) => (
          <BrandCard key={b.id} brand={b} />
        ))}
      </div>
    </div>
  );
}
