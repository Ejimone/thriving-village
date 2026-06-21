import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getMyEntries, getContest, naira, prizePool, photo } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function MyContestEntriesPage() {
  const session = await getSession();
  if (!session) redirect("/auth/signin");

  const entries = await getMyEntries(session.jwt);
  const contests = await Promise.all(entries.map((e) => getContest(e.contestId)));
  const rows = entries
    .map((e, i) => ({ entry: e, contest: contests[i] }))
    .filter((r) => r.contest !== null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[clamp(26px,4vw,32px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
          My contest entries
        </h1>
        <p className="mt-2 text-[16px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
          Everything you&apos;ve submitted, and how it&apos;s doing.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Trophy size={22} />}
          title="No entries yet"
          body="Enter a contest to show what you can do — and win cash."
          action={
            <Button href="/contests" variant="inverse">
              See contests
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map(({ entry: e, contest }) => (
            <Card key={e.contestId} padded={false} className="flex flex-col">
              <div className="relative h-32 bg-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo(contest!.seed, 500, 240)}
                  alt=""
                  className="h-full w-full object-cover tv-photo"
                />
                <span className="absolute right-3 top-3">
                  <StatusBadge status={e.status} />
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <Link
                  href={`/contests/${contest!.id}`}
                  className="text-[18px] font-semibold text-black [letter-spacing:var(--tv-track-tight)] hover:underline"
                >
                  {contest!.title}
                </Link>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral" size="sm">
                    {contest!.field}
                  </Badge>
                  <span className="text-[14px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                    {naira(prizePool(contest!))} pool
                  </span>
                </div>
                <p className="text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
                  Submitted {e.submittedAgo}
                </p>
                <div className="mt-auto">
                  <Button href={`/contests/${contest!.id}`} variant="outline" size="sm">
                    View contest
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
