import { BrandCard } from "@/components/cards/BrandCard";
import { BrandFilters } from "@/components/cards/BrandFilters";
import { getBrands, type BrandKind } from "@/lib/data";

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const kind = params.kind as BrandKind | undefined;
  const brands = await getBrands({ kind });

  return (
    <div className="tv-container pt-14">
      <h1 className="text-[clamp(36px,6vw,48px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
        Brands
      </h1>
      <p className="mt-3 max-w-[620px] text-[19px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        The businesses and partners in our world — the people building, hiring,
        and growing alongside our community.
      </p>

      <BrandFilters total={brands.length} />

      <div className="mt-6 grid gap-5 pb-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => (
          <BrandCard key={b.id} brand={b} />
        ))}
      </div>
    </div>
  );
}
