import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { photo, type Brand } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Brand poster tile — the brand's own thumbnail carries it (Apple TV / Netflix
 * style). Text-light: just the name and a tight tagline over a dark scrim.
 * `featured` makes a larger tile for the home page.
 */
export function BrandCard({
  brand,
  featured = false,
}: {
  brand: Brand;
  featured?: boolean;
}) {
  return (
    <a
      href={brand.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group relative block overflow-hidden rounded-card bg-gray-900",
        featured ? "aspect-[4/5]" : "aspect-[3/4]",
      )}
    >
      {/* The brand-designed thumbnail */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo(brand.seed, 800, 1000)}
        alt={brand.name}
        className="h-full w-full object-cover tv-photo transition-transform duration-500 group-hover:scale-105"
      />

      {/* Protection scrim for legibility */}
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,10,10,0.82),rgba(10,10,10,0.1)_55%,transparent_75%)]" />

      {/* Kind tag, top-left */}
      <span className="absolute left-4 top-4">
        <Badge tone="inverse" size="sm">
          {brand.kind}
        </Badge>
      </span>

      {/* Name + tagline, overlaid at the bottom */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <h3
            className={cn(
              "font-bold leading-tight text-white [letter-spacing:var(--tv-track-tight)]",
              featured ? "text-[28px]" : "text-2xl",
            )}
          >
            {brand.name}
          </h3>
          <ArrowUpRight
            size={featured ? 22 : 20}
            className="text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </div>
        <p
          className={cn(
            "max-w-[34ch] text-gray-300 [letter-spacing:var(--tv-track-tight)]",
            featured ? "text-base" : "text-[15px]",
          )}
        >
          {brand.tagline}
        </p>
      </div>
    </a>
  );
}
