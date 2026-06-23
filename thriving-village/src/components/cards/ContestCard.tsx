import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { naira, photo, prizePool, winnerCount, type Contest } from "@/lib/data";
import { cn } from "@/lib/utils";

const CONTEST_ACCENT = "var(--tv-accent-orange)";

/**
 * Contest poster tile — image-forward, with the prize and deadline overlaid.
 * Single accent (orange = contests). `featured` makes a larger tile.
 */
export function ContestCard({
  contest,
  featured = false,
  variant = "poster",
}: {
  contest: Contest;
  featured?: boolean;
  /** "list" renders a text-only row (matching JobCard) instead of the image poster tile. */
  variant?: "poster" | "list";
}) {
  const live = contest.status === "live";

  if (variant === "list") {
    return (
      <Link href={`/contests/${contest.id}`} className="block">
        <Card
          variant="flat"
          className="flex flex-col gap-4 px-6 py-5 transition-colors hover:border-gray-300 sm:flex-row sm:items-center sm:gap-5"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[19px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                {contest.title}
              </span>
              <Badge tone="neutral" size="sm">
                {contest.field}
              </Badge>
              {live ? (
                <Badge tone="accent" accent={CONTEST_ACCENT} size="sm">
                  {contest.daysLeft} days left
                </Badge>
              ) : (
                <Badge tone="outline" size="sm">
                  Ended
                </Badge>
              )}
            </div>
            <p className="mt-1.5 text-[15px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
              {winnerCount(contest)} winners · {contest.entries} entries
            </p>
          </div>

          <span className="text-[15px] font-semibold text-gray-800 whitespace-nowrap [letter-spacing:var(--tv-track-tight)]">
            {naira(prizePool(contest))} pool
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-pill bg-black px-[18px] py-2 text-sm font-semibold text-white">
            View <ArrowRight size={14} />
          </span>
        </Card>
      </Link>
    );
  }

  return (
    <Link
      href={`/contests/${contest.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-card bg-gray-900",
        featured ? "aspect-[4/5]" : "aspect-[3/4]",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo(contest.seed, 800, 1000)}
        alt=""
        className="h-full w-full object-cover tv-photo transition-transform duration-500 group-hover:scale-105"
      />

      {/* Protection scrim */}
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,10,10,0.85),rgba(10,10,10,0.15)_52%,transparent_72%)]" />

      {/* Deadline / status, top-left */}
      <span className="absolute left-4 top-4">
        {live ? (
          <Badge tone="accent" accent={CONTEST_ACCENT} size="sm">
            {contest.daysLeft} days left
          </Badge>
        ) : (
          <Badge tone="inverse" size="sm">
            Ended
          </Badge>
        )}
      </span>

      {/* Title + prize, overlaid at the bottom */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 sm:p-6">
        <div className="flex items-start gap-2">
          <h3
            className={cn(
              "flex-1 font-semibold leading-tight text-white [letter-spacing:var(--tv-track-tight)]",
              featured ? "text-2xl" : "text-xl",
            )}
          >
            {contest.title}
          </h3>
          <ArrowRight
            size={20}
            className="mt-1 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5"
          />
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-bold text-white [letter-spacing:var(--tv-track-tight)]",
              featured ? "text-[32px]" : "text-[26px]",
            )}
          >
            {naira(prizePool(contest))}
          </span>
          <span className="text-sm text-gray-300 [letter-spacing:var(--tv-track-tight)]">
            in prizes
          </span>
        </div>
        <p className="text-[13px] text-gray-300 [letter-spacing:var(--tv-track-tight)]">
          {winnerCount(contest)} winners · {contest.entries} entries
        </p>
      </div>
    </Link>
  );
}
