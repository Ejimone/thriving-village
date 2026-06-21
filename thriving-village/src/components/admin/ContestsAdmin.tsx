"use client";

import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { AdminCrud, type AdminRow } from "@/components/admin/AdminCrud";
import { saveContestAction, deleteContestAction } from "@/lib/actions/admin";
import { naira } from "@/lib/data";
import type { Contest } from "@/lib/data";

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
        <Input name="title" label="Contest title" placeholder="e.g. Logo Design Sprint" defaultValue={contest?.title} required />
        <div className="grid grid-cols-2 gap-4">
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
          <Select
            name="status"
            label="Status"
            defaultValue={contest?.status ?? "live"}
            options={[
              { label: "Live", value: "live" },
              { label: "Past", value: "past" },
            ]}
          />
        </div>
        <Input
          name="deadline"
          label="Deadline"
          type="datetime-local"
          defaultValue={contest?.deadline ? contest.deadline.slice(0, 16) : undefined}
          required
        />
        <Textarea name="brief" label="Brief" rows={3} placeholder="What entrants need to do." defaultValue={contest?.brief} required />
        <Textarea
          name="rules"
          label="Rules (one per line)"
          rows={3}
          placeholder={"Open to all skill levels\nOne entry per person"}
          defaultValue={contest?.rules.join("\n")}
        />
        <Textarea
          name="prizes"
          label="Prizes (JSON array)"
          rows={4}
          placeholder='[{"place":1,"label":"1st Place","amount":100000}]'
          defaultValue={contest ? JSON.stringify(contest.prizes, null, 2) : ""}
          hint='Each entry needs place, label, amount. e.g. [{"place":1,"label":"1st Place","amount":100000}]'
        />
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
