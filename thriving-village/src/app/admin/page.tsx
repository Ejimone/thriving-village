import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LiveActivityFeed } from "@/components/admin/LiveActivityFeed";
import { getAdminStats, getAdminActivity } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function AdminOverview() {
  const session = await getSession();
  if (!session) redirect("/auth/signin");

  const [stats, activity] = await Promise.all([
    getAdminStats(session.jwt),
    getAdminActivity(session.jwt),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[clamp(26px,4vw,32px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
          Overview
        </h1>
        <p className="mt-2 text-[16px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
          A snapshot of the platform today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className="text-[14px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
              {s.label}
            </p>
            <p className="mt-1.5 text-[34px] font-bold leading-none text-black [letter-spacing:var(--tv-track-tighter)]">
              {s.value}
            </p>
            {s.delta && (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-success [letter-spacing:var(--tv-track-tight)]">
                <TrendingUp size={14} />
                {s.delta}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Activity feed — live via SSE, seeded from the server-rendered list below */}
      <div>
        <h2 className="mb-4 text-[22px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
          Recent activity
        </h2>
        <LiveActivityFeed initial={activity} />
      </div>
    </div>
  );
}
