import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { AdminCrud, type AdminRow } from "@/components/admin/AdminCrud";
import { PrizeTiersField } from "@/components/admin/PrizeTiersField";
import { CONTESTS, naira, prizePool, winnerCount } from "@/lib/data";

const rows: AdminRow[] = CONTESTS.map((c) => ({
  id: c.id,
  cells: [
    c.title,
    naira(prizePool(c)),
    `${winnerCount(c)} winners`,
    String(c.entries),
    <Badge key="s" tone={c.status === "live" ? "inverse" : "outline"} size="sm">
      {c.status === "live" ? "Live" : "Ended"}
    </Badge>,
    c.status === "live" ? `${c.daysLeft} days left` : "—",
  ],
}));

const form = (
  <>
    <Input label="Contest title" placeholder="e.g. Logo for a Lagos café" />
    <div className="grid grid-cols-2 gap-4">
      <Select
        label="Field"
        options={[
          { label: "Digital", value: "Digital" },
          { label: "Technical", value: "Technical" },
          { label: "Craft", value: "Craft" },
          { label: "Creative", value: "Creative" },
        ]}
      />
      <Input label="Deadline" type="date" />
    </div>
    <PrizeTiersField />
    <Textarea label="Brief" rows={4} placeholder="What should people make? Keep it simple." />
  </>
);

export default function AdminContestsPage() {
  return (
    <AdminCrud
      title="Contests"
      subtitle="Create and manage talent contests."
      newLabel="New contest"
      noun="contest"
      columns={["Title", "Prize pool", "Winners", "Entries", "Status", "Deadline"]}
      rows={rows}
      form={form}
    />
  );
}
