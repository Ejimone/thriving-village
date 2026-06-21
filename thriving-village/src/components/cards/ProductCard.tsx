import Link from "next/link";
import { naira, photo, productMeta, type Product } from "@/lib/data";

/**
 * Product cell — minimal gallery style. No card chrome or labels: the hairline
 * grid does the framing, and each cell shows just name, price, and maker.
 * Designed to sit inside a bordered line-grid (see the shop catalog).
 */
export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/shop/${product.id}`}
      className="group flex flex-col border-b border-r border-gray-200"
    >
      <div className="aspect-square w-full overflow-hidden bg-gray-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo(product.seed, 600, 600)}
          alt={product.name}
          className="h-full w-full object-cover tv-photo transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[16px] font-semibold text-black [letter-spacing:var(--tv-track-tight)] group-hover:underline">
            {product.name}
          </h3>
          <span className="shrink-0 text-[15px] font-semibold text-black tabular-nums [letter-spacing:var(--tv-track-tight)]">
            {naira(product.price)}
          </span>
        </div>
        <p className="text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          {productMeta(product)}
        </p>
      </div>
    </Link>
  );
}
