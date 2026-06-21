import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { AdminCrud, type AdminRow } from "@/components/admin/AdminCrud";
import { JOBS } from "@/lib/data";

const rows: AdminRow[] = JOBS.map((j) => ({
  id: j.id,
  cells: [
    j.title,
    j.org,
    <Badge key="f" tone="neutral" size="sm">
      {j.field}
    </Badge>,
    `${j.location} · ${j.locationType}`,
    j.pay,
  ],
}));

const form = (
  <>
    <Input label="Job title" placeholder="e.g. Frontend Developer" />
    <Input label="Company / org" placeholder="e.g. Hubway Digital" />
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
      <Select
        label="Location type"
        options={[
          { label: "Remote", value: "Remote" },
          { label: "Onsite", value: "Onsite" },
          { label: "Hybrid", value: "Hybrid" },
        ]}
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Input label="Location" placeholder="e.g. Lagos" />
      <Input label="Pay" placeholder="e.g. ₦450k–700k / mo" />
    </div>
    <Textarea label="Summary" rows={3} placeholder="Short, plain description of the role." />
  </>
);

export default function AdminJobsPage() {
  return (
    <AdminCrud
      title="Jobs"
      subtitle="Create and manage roles on the job board."
      newLabel="New job"
      noun="job"
      columns={["Title", "Company", "Field", "Location", "Pay"]}
      rows={rows}
      form={form}
    />
  );
}
