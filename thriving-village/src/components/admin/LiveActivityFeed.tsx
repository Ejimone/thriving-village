"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { timeAgo } from "@/lib/utils";

type ActivityItem = { who: string; what: string; when: string };

const MAX_ITEMS = 6;

/** Seeds from the server-rendered list, then keeps itself current via SSE — no polling. */
export function LiveActivityFeed({ initial }: { initial: ActivityItem[] }) {
  const [items, setItems] = useState(initial);
  const [justArrivedKey, setJustArrivedKey] = useState<string | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/admin/activity-stream");

    source.addEventListener("activity", (event) => {
      const payload = JSON.parse(event.data) as ActivityItem;
      const key = `${payload.who}-${payload.what}-${payload.when}`;
      setItems((prev) => [payload, ...prev].slice(0, MAX_ITEMS));
      setJustArrivedKey(key);
      setTimeout(() => setJustArrivedKey((k) => (k === key ? null : k)), 3000);
    });

    return () => source.close();
  }, []);

  if (items.length === 0) {
    return (
      <p className="text-[15px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
        No activity yet.
      </p>
    );
  }

  return (
    <Card variant="flat" className="divide-y divide-gray-200 !p-0">
      {items.map((a, i) => {
        const key = `${a.who}-${a.what}-${a.when}`;
        return (
          <div
            key={`${key}-${i}`}
            className={`flex items-center gap-4 px-5 py-4 transition-colors duration-500 ${
              key === justArrivedKey ? "bg-[color:var(--tv-accent-yellow)]/10" : ""
            }`}
          >
            <Avatar name={a.who} size={40} />
            <p className="flex-1 text-[15px] text-gray-800 [letter-spacing:var(--tv-track-tight)]">
              <span className="font-semibold text-black">{a.who}</span> {a.what}
            </p>
            {key === justArrivedKey && (
              <Badge tone="accent" accent="var(--tv-accent-green)" size="sm">
                New
              </Badge>
            )}
            <span className="text-[13px] text-gray-400 whitespace-nowrap">{timeAgo(a.when)}</span>
          </div>
        );
      })}
    </Card>
  );
}
