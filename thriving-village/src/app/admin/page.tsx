import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { ADMIN_STATS, ADMIN_ACTIVITY } from "@/lib/data";

export default function AdminOverview() {
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
        {ADMIN_STATS.map((s) => (
          <Card key={s.label}>
            <p className="text-[14px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
              {s.label}
            </p>
            <p className="mt-1.5 text-[34px] font-bold leading-none text-black [letter-spacing:var(--tv-track-tighter)]">
              {s.value}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-success [letter-spacing:var(--tv-track-tight)]">
              <TrendingUp size={14} />
              {s.delta}
            </p>
          </Card>
        ))}
      </div>

      {/* Activity feed */}
      <div>
        <h2 className="mb-4 text-[22px] font-bold text-black [letter-spacing:var(--tv-track-tight)]">
          Recent activity
        </h2>
        <Card variant="flat" className="divide-y divide-gray-200 !p-0">
          {ADMIN_ACTIVITY.map((a, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Avatar name={a.who} size={40} />
              <p className="flex-1 text-[15px] text-gray-800 [letter-spacing:var(--tv-track-tight)]">
                <span className="font-semibold text-black">{a.who}</span> {a.what}
              </p>
              <span className="text-[13px] text-gray-400 whitespace-nowrap">
                {a.when}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
