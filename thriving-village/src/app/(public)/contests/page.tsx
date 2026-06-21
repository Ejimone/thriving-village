import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ContestCard } from "@/components/cards/ContestCard";
import { getContests } from "@/lib/data";

const CONTEST_ACCENT = "var(--tv-accent-orange)";

export default async function ContestsPage() {
  const [{ items: live }, { items: past }] = await Promise.all([
    getContests({ status: "live", pageSize: 6 }),
    getContests({ status: "past", pageSize: 6 }),
  ]);

  return (
    <div>
      {/* Hero band — the single accent moment for this page */}
      <section style={{ background: CONTEST_ACCENT }}>
        <div className="tv-container py-16">
          <Badge tone="inverse" size="md">
            Contests
          </Badge>
          <h1 className="mt-4 max-w-[760px] text-[clamp(40px,7vw,60px)] font-bold leading-[1.03] text-black [letter-spacing:var(--tv-track-tighter)]">
            Show what you can do. Win cash.
          </h1>
          <p className="mt-4 max-w-[560px] text-[clamp(17px,2.4vw,20px)] leading-snug text-black/80 [letter-spacing:var(--tv-track-tight)]">
            A way to discover the best people while rewarding them. Open to
            everyone.
          </p>
          <div className="mt-7">
            <Button href="#live" variant="inverse" size="lg">
              Enter a contest
            </Button>
          </div>
        </div>
      </section>

      {/* Live */}
      <section id="live" className="tv-container pt-14 scroll-mt-20">
        <h2 className="mb-6 text-[clamp(26px,4vw,32px)] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
          Live now
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {live.map((c) => (
            <ContestCard key={c.id} contest={c} />
          ))}
        </div>
      </section>

      {/* Past */}
      <section className="tv-container pt-16">
        <h2 className="mb-6 text-[clamp(26px,4vw,32px)] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
          Past contests
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {past.map((c) => (
            <ContestCard key={c.id} contest={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
