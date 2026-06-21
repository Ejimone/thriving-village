"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { naira } from "@/lib/utils";

type Tier = { id: number; label: string; amount: string };

const ordinal = (n: number) =>
  ["1st place", "2nd place", "3rd place"][n - 1] ?? `${n}th place`;

/**
 * Editor for a contest's prize structure. A campaign can reward one winner or
 * several — add or remove tiers freely. UI only; the dev team persists this.
 */
export function PrizeTiersField() {
  const [tiers, setTiers] = useState<Tier[]>([
    { id: 1, label: "1st place", amount: "500000" },
    { id: 2, label: "2nd place", amount: "200000" },
    { id: 3, label: "3rd place", amount: "100000" },
  ]);
  const [nextId, setNextId] = useState(4);

  const pool = tiers.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  function add() {
    setTiers((t) => [
      ...t,
      { id: nextId, label: ordinal(t.length + 1), amount: "" },
    ]);
    setNextId((n) => n + 1);
  }

  function remove(id: number) {
    setTiers((t) => (t.length > 1 ? t.filter((x) => x.id !== id) : t));
  }

  function update(id: number, key: "label" | "amount", value: string) {
    setTiers((t) => t.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
          Prizes ({tiers.length} {tiers.length === 1 ? "winner" : "winners"})
        </span>
        <span className="text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          Pool: {naira(pool)}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {tiers.map((t, i) => (
          <div key={t.id} className="flex items-end gap-2">
            <span className="flex h-12 w-7 flex-none items-center justify-center text-[15px] font-bold text-gray-400 tabular-nums">
              {i + 1}
            </span>
            <div className="flex-1">
              <Input
                aria-label="Prize label"
                placeholder="e.g. 1st place, Runner-up"
                value={t.label}
                onChange={(e) => update(t.id, "label", e.target.value)}
              />
            </div>
            <div className="w-[140px] flex-none">
              <Input
                aria-label="Amount"
                type="number"
                prefix="₦"
                placeholder="0"
                value={t.amount}
                onChange={(e) => update(t.id, "amount", e.target.value)}
              />
            </div>
            <IconButton
              variant="ghost"
              size="md"
              aria-label="Remove prize tier"
              disabled={tiers.length === 1}
              onClick={() => remove(t.id)}
            >
              <Trash2 size={16} />
            </IconButton>
          </div>
        ))}
      </div>

      <div>
        <Button
          variant="outline"
          size="sm"
          iconLeft={<Plus size={16} />}
          onClick={add}
        >
          Add winner
        </Button>
      </div>
    </div>
  );
}
