import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  page: number;
  pageCount: number;
  /** Builds the href for a given page, e.g. (p) => `/jobs?${withPage(p)}`. */
  hrefForPage: (page: number) => string;
};

/** Server-renderable — just links, no client JS. Every page change is a fresh, scoped fetch. */
export function Pagination({ page, pageCount, hrefForPage }: Props) {
  if (pageCount <= 1) return null;

  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <Button
        variant="outline"
        size="sm"
        href={hrefForPage(Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={page <= 1 ? "pointer-events-none opacity-40" : undefined}
        iconLeft={<ChevronLeft size={16} />}
      >
        Previous
      </Button>
      <span className="text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
        Page {page} of {pageCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        href={hrefForPage(Math.min(pageCount, page + 1))}
        aria-disabled={page >= pageCount}
        className={page >= pageCount ? "pointer-events-none opacity-40" : undefined}
        iconRight={<ChevronRight size={16} />}
      >
        Next
      </Button>
    </div>
  );
}
