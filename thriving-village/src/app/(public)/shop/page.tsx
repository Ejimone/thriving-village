import { ShoppingBag } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { ProductCard } from "@/components/cards/ProductCard";
import { ShopFilters } from "@/components/shop/ShopFilters";
import {
  getProducts,
  type ProductCategory,
  type ProductType,
  type ProductCondition,
  type PriceBand,
} from "@/lib/data";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;

  const { items: products, total, pageCount } = await getProducts({
    category: params.category as ProductCategory | undefined,
    type: params.type as ProductType | undefined,
    condition: params.condition as ProductCondition | undefined,
    price: params.price as PriceBand | undefined,
    query: params.query,
    sort: params.sort as "featured" | "price-asc" | "price-desc" | undefined,
    page,
  });

  const hrefForPage = (p: number) => {
    const next = new URLSearchParams(params as Record<string, string>);
    next.set("page", String(p));
    return `/shop?${next.toString()}`;
  };

  return (
    <div className="tv-container pt-14">
      <h1 className="text-[clamp(36px,6vw,48px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
        Shop
      </h1>
      <p className="mt-3 max-w-[640px] text-[19px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
        A marketplace for our community — merch made by our talent, plus the gear
        you need to do the work: laptops, phones, tools, and more. New and used.
      </p>

      <ShopFilters total={total} />

      {products.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 overflow-hidden rounded-card border-l border-t border-gray-200 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={<ShoppingBag size={22} />}
            title="No products match your filters yet"
            body="Try widening your search or clearing a filter — new drops land often."
            action={
              <Button variant="outline" href="/shop">
                Clear filters
              </Button>
            }
          />
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} hrefForPage={hrefForPage} />

      <p className="py-6 text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
        Checkout is securely handled by Shopify.
      </p>
    </div>
  );
}
