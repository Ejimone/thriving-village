"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { AdminCrud, type AdminRow } from "@/components/admin/AdminCrud";
import { saveContestAction, deleteContestAction } from "@/lib/actions/admin";
import { naira } from "@/lib/data";
import type { Contest, ContestPrize } from "@/lib/data";

const DEFAULT_PRIZES: ContestPrize[] = [
  { place: 1, label: "1st place", amount: 500000 },
  { place: 2, label: "2nd place", amount: 200000 },
  { place: 3, label: "3rd place", amount: 100000 },
];

function PrizesField({ initial }: { initial: ContestPrize[] }) {
  const [rows, setRows] = useState<ContestPrize[]>(initial);
  const pool = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  function updateRow(i: number, patch: Partial<ContestPrize>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { place: prev.length + 1, label: `${prev.length + 1}th place`, amount: 0 }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, place: idx + 1 })));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
          {`Prizes (${rows.length} winner${rows.length === 1 ? "" : "s"})`}
        </span>
        <span className="text-[13px] text-gray-500">{`Pool: ${naira(pool)}`}</span>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-4 shrink-0 text-sm text-gray-400">{i + 1}</span>
          <div className="flex-1">
            <Input value={row.label} onChange={(e) => updateRow(i, { label: e.target.value })} />
          </div>
          <div className="w-36 shrink-0">
            <Input
              type="number"
              prefix="₦"
              value={row.amount}
              onChange={(e) => updateRow(i, { amount: Number(e.target.value) })}
            />
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Delete prize"
            onClick={() => removeRow(i)}
            disabled={rows.length <= 1}
          >
            <Trash2 size={16} />
          </IconButton>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addRow} className="self-start">
        + Add winner
      </Button>
      <input type="hidden" name="prizes" value={JSON.stringify(rows)} />
    </div>
  );
}

export function ContestsAdmin({ contests }: { contests: Contest[] }) {
  const byId = new Map(contests.map((c) => [c.documentId, c]));

  const rows: AdminRow[] = contests.map((c) => ({
    id: c.documentId,
    label: c.title,
    cells: [
      c.title,
      <Badge key="f" tone="neutral" size="sm">
        {c.field}
      </Badge>,
      <Badge key="s" tone={c.status === "live" ? "accent" : "outline"} size="sm">
        {c.status}
      </Badge>,
      naira(c.prizePoolTotal),
      String(c.entries),
    ],
  }));

  function renderForm(documentId: string | null) {
    const contest = documentId ? byId.get(documentId) : undefined;
    return (
      <>
        <Input name="title" label="Contest title" placeholder="e.g. Logo for a Lagos café" defaultValue={contest?.title} required />
        <div className="grid grid-cols-[40%_55%] gap-4">
          <Select
            name="field"
            label="Field"
            defaultValue={contest?.field}
            options={[
              { label: "Digital", value: "Digital" },
              { label: "Technical", value: "Technical" },
              { label: "Craft", value: "Craft" },
              { label: "Creative", value: "Creative" },
            ]}
          />
          <Input
            name="deadline"
            label="Deadline"
            type="date"
            defaultValue={contest?.deadline ? contest.deadline.slice(0, 10) : undefined}
            required
          />
        </div>
        <Select
          name="status"
          label="Status"
          defaultValue={contest?.status ?? "live"}
          options={[
            { label: "Live", value: "live" },
            { label: "Past", value: "past" },
          ]}
        />
        <Textarea
          name="brief"
          label="Brief"
          rows={3}
          placeholder="What should people make? Keep it simple."
          defaultValue={contest?.brief}
          required
        />
        {/* Rules has no UI now — preserve whatever the contest already had so editing doesn't wipe it. */}
        <input type="hidden" name="rules" value={contest?.rules.join("\n") ?? ""} />
        <PrizesField initial={contest?.prizes ?? DEFAULT_PRIZES} />
      </>
    );
  }

  return (
    <AdminCrud
      title="Contests"
      subtitle="Create and manage contests."
      newLabel="New contest"
      noun="contest"
      columns={["Title", "Field", "Status", "Prize pool", "Entries"]}
      rows={rows}
      renderForm={renderForm}
      onSave={saveContestAction}
      onDelete={deleteContestAction}
    />
  );
}
