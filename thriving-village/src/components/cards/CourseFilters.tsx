"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Tag } from "@/components/ui/Tag";
import { Select } from "@/components/ui/Select";
import { PRICE_BANDS, type Field, type CourseDelivery, type CourseKind, type ExperienceLevel, type PriceBand } from "@/lib/data";

const FIELDS: (Field | "All")[] = ["All", "Digital", "Technical", "Craft", "Creative"];

export function CourseFilters({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const field = (searchParams.get("field") as Field | null) ?? "All";
  const delivery = (searchParams.get("delivery") as CourseDelivery | null) ?? "All";
  const kind = (searchParams.get("kind") as CourseKind | null) ?? "All";
  const level = (searchParams.get("level") as ExperienceLevel | null) ?? "All";
  const price = (searchParams.get("price") as PriceBand | null) ?? "all";

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value || value === "All" || value === "all") params.delete(key);
      else params.set(key, value);
    });
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const active = field !== "All" || delivery !== "All" || kind !== "All" || level !== "All" || price !== "all";

  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          aria-label="Delivery"
          value={delivery}
          onChange={(e) => pushParams({ delivery: e.target.value })}
          options={[
            { label: "Any delivery", value: "All" },
            { label: "Online", value: "Online" },
            { label: "Onsite", value: "Onsite" },
            { label: "Hybrid", value: "Hybrid" },
          ]}
        />
        <Select
          aria-label="Type"
          value={kind}
          onChange={(e) => pushParams({ kind: e.target.value })}
          options={[
            { label: "Any type", value: "All" },
            { label: "Course", value: "Course" },
            { label: "Certification", value: "Certification" },
          ]}
        />
        <Select
          aria-label="Level"
          value={level}
          onChange={(e) => pushParams({ level: e.target.value })}
          options={[
            { label: "Any level", value: "All" },
            { label: "Entry", value: "Entry" },
            { label: "Mid", value: "Mid" },
            { label: "Senior", value: "Senior" },
          ]}
        />
        <Select
          aria-label="Price"
          value={price}
          onChange={(e) => pushParams({ price: e.target.value })}
          options={PRICE_BANDS}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {FIELDS.map((f) => (
          <Tag key={f} selected={field === f} onClick={() => pushParams({ field: f })}>
            {f}
          </Tag>
        ))}
        <span className="ml-auto text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          {total} {total === 1 ? "course" : "courses"}
        </span>
      </div>

      {active && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="mt-3 text-sm font-semibold text-gray-500 underline-offset-2 hover:text-black hover:underline [letter-spacing:var(--tv-track-tight)]"
        >
          Clear filters
        </button>
      )}
    </>
  );
}
