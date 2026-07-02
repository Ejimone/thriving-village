import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy, Users, CalendarClock, Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { ApplyDialog } from "@/components/cards/ApplyDialog";
import { getContest, getLeaderboard, naira, prizePool, winnerCount } from "@/lib/data";
import { enterContestAction } from "@/lib/actions/applications";

const CONTEST_ACCENT = "var(--tv-accent-orange)";

export default async function ContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Both keyed by the same id, independent of each other — fetch in one wave.
  const [contest, leaderboard] = await Promise.all([getContest(id), getLeaderboard(id)]);
  if (!contest) notFound();

  const live = contest.status === "live";

  // Prize tiers ordered top-first.
  const prizes = [...contest.prizes].sort((a, b) => a.place - b.place);

  const stats = [
    { icon: <Trophy size={16} />, label: "Prize pool", value: naira(prizePool(contest)) },
    { icon: <Users size={16} />, label: "Entries", value: String(contest.entries) },
    {
      icon: <CalendarClock size={16} />,
      label: live ? "Closes in" : "Status",
      value: live ? `${contest.daysLeft} days` : "Ended",
    },
  ];

  return (
    <div className="tv-container pt-10 pb-4">
      <Link
        href="/contests"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black [letter-spacing:var(--tv-track-tight)]"
      >
        <ArrowLeft size={16} /> All contests
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main */}
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="neutral" size="md">
              {contest.field}
            </Badge>
            {live ? (
              <Badge tone="accent" accent={CONTEST_ACCENT} size="md">
                {contest.daysLeft} days left
              </Badge>
            ) : (
              <Badge tone="outline" size="md">
                Ended
              </Badge>
            )}
          </div>
          <h1 className="mt-4 text-[clamp(30px,5vw,44px)] font-bold leading-[1.05] text-black [letter-spacing:var(--tv-track-tighter)]">
            {contest.title}
          </h1>

          <h2 className="mt-8 text-xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
            The brief
          </h2>
          <p className="mt-3 max-w-[640px] text-[17px] leading-relaxed text-gray-700 [letter-spacing:var(--tv-track-tight)]">
            {contest.brief}
          </p>

          {/* Prize breakdown — flexible per campaign (one or more winners) */}
          <h2 className="mt-8 text-xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
            Prizes
          </h2>
          <p className="mt-1 text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
            {winnerCount(contest)} {winnerCount(contest) === 1 ? "winner" : "winners"} ·{" "}
            {naira(prizePool(contest))} total
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {prizes.map((p, i) => (
              <Card
                key={p.place}
                variant={i === 0 ? "default" : "flat"}
                className="flex flex-col gap-1"
                style={i === 0 ? { borderColor: CONTEST_ACCENT } : undefined}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.05em] text-gray-500">
                  {i === 0 && <Trophy size={13} style={{ color: CONTEST_ACCENT }} />}
                  {p.label}
                </span>
                <span className="text-[22px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
                  {naira(p.amount)}
                </span>
              </Card>
            ))}
          </div>

          <h2 className="mt-10 text-xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
            Rules
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {contest.rules.map((r) => (
              <li
                key={r}
                className="flex items-start gap-3 text-base text-gray-700 [letter-spacing:var(--tv-track-tight)]"
              >
                <Check size={18} className="mt-0.5 flex-none text-black" />
                {r}
              </li>
            ))}
          </ul>

          {/* Leaderboard */}
          <h2 className="mt-10 text-xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
            Leaderboard
          </h2>
          <p className="mt-1 text-sm text-gray-500 [letter-spacing:var(--tv-track-tight)]">
            {live
              ? "Ranking is provisional until judging closes."
              : "Final results."}
          </p>
          {leaderboard.length > 0 ? (
            <Card variant="flat" className="mt-3 divide-y divide-gray-200 !p-0">
              {leaderboard.map((e) => (
                <div key={e.rank} className="flex items-center gap-4 px-5 py-4">
                  <span className="w-6 text-center text-lg font-bold text-gray-400 tabular-nums">
                    {e.rank}
                  </span>
                  <Avatar name={e.name} size={40} />
                  <div className="flex-1">
                    <p className="flex items-center gap-2 text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                      {e.name}
                      {e.prize && (
                        <Badge tone="accent" accent={CONTEST_ACCENT} size="sm">
                          Winner
                        </Badge>
                      )}
                    </p>
                    <p className="text-[13px] text-gray-500">{e.note}</p>
                  </div>
                  {e.prize ? (
                    <span className="flex items-center gap-1.5 text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                      <Trophy size={16} style={{ color: CONTEST_ACCENT }} />
                      {naira(e.prize.amount)}
                    </span>
                  ) : null}
                </div>
              ))}
            </Card>
          ) : (
            <p className="mt-3 text-[15px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
              Ranking hasn&apos;t been published yet.
            </p>
          )}
        </div>

        {/* Submission rail */}
        <aside className="lg:sticky lg:top-[88px] lg:self-start">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 border-b border-gray-200 pb-4">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
                    <span className="text-gray-400">{s.icon}</span>
                    {s.label}
                  </span>
                  <span className="text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
            {live ? (
              <ApplyDialog
                fullWidth
                label="Submit your entry"
                title={`Enter — ${contest.title}`}
                subtitle={`${winnerCount(contest)} winners · ${naira(prizePool(contest))} pool`}
                promptLabel="Describe your entry"
                promptName="description"
                promptRequired
                withFile
                fileHint="Upload your work — image, PDF, or zip"
                successMessage="Entry submitted. Good luck!"
                action={enterContestAction.bind(null, contest.id)}
              />
            ) : (
              <div className="rounded-sm bg-gray-100 px-4 py-3 text-center text-sm text-gray-600 [letter-spacing:var(--tv-track-tight)]">
                This contest has ended.
              </div>
            )}
            <p className="text-center text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
              Results are announced on WhatsApp.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
