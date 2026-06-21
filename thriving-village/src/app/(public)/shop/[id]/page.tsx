import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProductPurchase } from "@/components/shop/ProductPurchase";
import { ProductCard } from "@/components/cards/ProductCard";
import { getProduct, getProducts, naira, photo } from "@/lib/data";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const { items: candidates } = await getProducts({ pageSize: 4 });
  const more = candidates.filter((p) => p.id !== product.id).slice(0, 3);

  return (
    <div className="tv-container pt-10 pb-4">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black [letter-spacing:var(--tv-track-tight)]"
      >
        <ArrowLeft size={16} /> Shop
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* Image */}
        <div className="overflow-hidden rounded-card bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo(product.seed, 800, 800)}
            alt={product.name}
            className="aspect-square h-full w-full object-cover tv-photo"
          />
        </div>

        {/* Details + purchase */}
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="neutral" size="md">
              {product.type}
            </Badge>
            {product.condition && (
              <Badge tone="outline" size="md">
                {product.condition}
              </Badge>
            )}
          </div>
          <h1 className="mt-4 text-[clamp(28px,5vw,40px)] font-bold leading-[1.05] text-black [letter-spacing:var(--tv-track-tighter)]">
            {product.name}
          </h1>
          {(product.maker || product.brand) && (
            <p className="mt-2 text-[15px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
              {product.maker ? `Made by ${product.maker}` : product.brand}
            </p>
          )}
          <p className="mt-4 text-[24px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
            {naira(product.price)}
          </p>
          <p className="mt-4 max-w-[520px] text-[17px] leading-relaxed text-gray-700 [letter-spacing:var(--tv-track-tight)]">
            {product.blurb}
          </p>

          <ul className="mt-5 flex flex-col gap-2.5">
            {product.details.map((d) => (
              <li
                key={d}
                className="flex items-start gap-3 text-[15px] text-gray-700 [letter-spacing:var(--tv-track-tight)]"
              >
                <Check size={17} className="mt-0.5 flex-none text-black" />
                {d}
              </li>
            ))}
          </ul>

          <div className="mt-7 max-w-[420px]">
            <ProductPurchase product={product} />
          </div>
        </div>
      </div>

      {/* More merch */}
      <section className="mt-16">
        <h2 className="mb-6 text-[22px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
          More from the shop
        </h2>
        <div className="grid grid-cols-1 overflow-hidden rounded-card border-l border-t border-gray-200 sm:grid-cols-2 lg:grid-cols-3">
          {more.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
