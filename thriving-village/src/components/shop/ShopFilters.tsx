"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Tag";
import { Select } from "@/components/ui/Select";
import {
  PRICE_BANDS,
  CATEGORY_TYPES,
  CONDITIONS,
  type ProductCategory,
  type ProductType,
  type ProductCondition,
  type PriceBand,
} from "@/lib/data";

const CATEGORIES: (ProductCategory | "All")[] = [
  "All",
  "Apparel",
  "Accessories",
  "Electronics",
  "Tools",
  "Furniture",
  "Home",
];

type Sort = "featured" | "price-asc" | "price-desc";

export function ShopFilters({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const category = (searchParams.get("category") as ProductCategory | null) ?? "All";
  const type = (searchParams.get("type") as ProductType | null) ?? "All";
  const condition = (searchParams.get("condition") as ProductCondition | null) ?? "All";
  const price = (searchParams.get("price") as PriceBand | null) ?? "all";
  const sort = (searchParams.get("sort") as Sort | null) ?? "featured";

  const typeOptions = useMemo(() => {
    const types = category === "All" ? (Object.values(CATEGORY_TYPES).flat() as ProductType[]) : CATEGORY_TYPES[category];
    return [{ label: "Any type", value: "All" }, ...types.map((t) => ({ label: t, value: t }))];
  }, [category]);

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value || value === "All" || value === "all" || value === "featured") params.delete(key);
      else params.set(key, value);
    });
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function onCategory(c: ProductCategory | "All") {
    // Reset the type filter when it no longer belongs to the chosen category.
    const stillValid = c === "All" || type === "All" || CATEGORY_TYPES[c].includes(type as ProductType);
    pushParams({ category: c, ...(stillValid ? {} : { type: null }) });
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

  const active = query || category !== "All" || type !== "All" || condition !== "All" || price !== "all" || sort !== "featured";

  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Input
          placeholder="Search products"
          prefix={<Search size={18} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select aria-label="Type" value={type} onChange={(e) => pushParams({ type: e.target.value })} options={typeOptions} />
        <Select
          aria-label="Condition"
          value={condition}
          onChange={(e) => pushParams({ condition: e.target.value })}
          options={[{ label: "Any condition", value: "All" }, ...CONDITIONS.map((c) => ({ label: c, value: c }))]}
        />
        <Select aria-label="Price" value={price} onChange={(e) => pushParams({ price: e.target.value })} options={PRICE_BANDS} />
        <Select
          aria-label="Sort"
          value={sort}
          onChange={(e) => pushParams({ sort: e.target.value })}
          options={[
            { label: "Featured", value: "featured" },
            { label: "Price: low to high", value: "price-asc" },
            { label: "Price: high to low", value: "price-desc" },
          ]}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => (
          <Tag key={c} selected={category === c} onClick={() => onCategory(c)}>
            {c}
          </Tag>
        ))}
        <span className="ml-auto text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          {total} {total === 1 ? "item" : "items"}
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
