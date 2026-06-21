"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Tag";
import { Select } from "@/components/ui/Select";
import type { Field, LocationType, ExperienceLevel } from "@/lib/data";

const FIELDS: (Field | "All")[] = ["All", "Digital", "Technical", "Craft", "Creative"];

/**
 * Pure URL-param controls — no client-side filtering of a loaded dataset.
 * Every change here pushes a new URL, which re-runs the server component's
 * fetch with the new `filters`/`pagination` — exactly one scoped request
 * per filter change, never "fetch everything and filter in the browser."
 */
export function JobFilters({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const field = (searchParams.get("field") as Field | null) ?? "All";
  const location = (searchParams.get("location") as LocationType | null) ?? "All";
  const level = (searchParams.get("level") as ExperienceLevel | null) ?? "All";

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value || value === "All") params.delete(key);
      else params.set(key, value);
    });
    params.delete("page"); // any filter change resets to page 1
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (query !== (searchParams.get("query") ?? "")) pushParams({ query: query || null });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const reset = () => {
    setQuery("");
    router.push(pathname);
  };

  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search roles, e.g. welder, designer"
          prefix={<Search size={18} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          aria-label="Location"
          value={location}
          onChange={(e) => pushParams({ location: e.target.value })}
          options={[
            { label: "Any location", value: "All" },
            { label: "Remote", value: "Remote" },
            { label: "Onsite", value: "Onsite" },
            { label: "Hybrid", value: "Hybrid" },
          ]}
        />
        <Select
          aria-label="Experience level"
          value={level}
          onChange={(e) => pushParams({ level: e.target.value })}
          options={[
            { label: "Any level", value: "All" },
            { label: "Entry", value: "Entry" },
            { label: "Mid", value: "Mid" },
            { label: "Senior", value: "Senior" },
          ]}
        />
        <div className="flex items-center">
          <span className="text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
            {total} {total === 1 ? "role" : "roles"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FIELDS.map((f) => (
          <Tag key={f} selected={field === f} onClick={() => pushParams({ field: f })}>
            {f}
          </Tag>
        ))}
      </div>

      {(query || field !== "All" || location !== "All" || level !== "All") && (
        <button
          type="button"
          onClick={reset}
          className="mt-3 text-sm font-semibold text-gray-500 underline-offset-2 hover:text-black hover:underline [letter-spacing:var(--tv-track-tight)]"
        >
          Clear filters
        </button>
      )}
    </>
  );
}
