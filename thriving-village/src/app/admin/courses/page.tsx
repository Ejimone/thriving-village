import { Award } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { AdminCrud, type AdminRow } from "@/components/admin/AdminCrud";
import { COURSES, naira } from "@/lib/data";

const rows: AdminRow[] = COURSES.map((c) => ({
  id: c.id,
  cells: [
    c.title,
    <div key="t" className="flex flex-wrap items-center gap-1.5">
      <Badge tone="neutral" size="sm">
        {c.field}
      </Badge>
      {c.kind === "Certification" && (
        <Badge tone="outline" size="sm">
          <Award size={11} />
          Cert
        </Badge>
      )}
    </div>,
    c.delivery === "Online"
      ? "Online"
      : `${c.delivery}${c.location ? ` · ${c.location}` : ""}`,
    naira(c.price),
    `${c.weeks} wks · ${c.lessonCount} lessons`,
  ],
}));

const form = (
  <>
    <Input label="Course title" placeholder="e.g. Frontend Development" />
    <Input label="Instructor" placeholder="e.g. Ada Okonkwo" />
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
        label="Level"
        options={[
          { label: "Entry", value: "Entry" },
          { label: "Mid", value: "Mid" },
          { label: "Senior", value: "Senior" },
        ]}
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Select
        label="Type"
        options={[
          { label: "Course", value: "Course" },
          { label: "Certification", value: "Certification" },
        ]}
      />
      <Select
        label="Delivery"
        options={[
          { label: "Online", value: "Online" },
          { label: "Onsite", value: "Onsite" },
          { label: "Hybrid", value: "Hybrid" },
        ]}
      />
    </div>
    <Input
      label="Location"
      placeholder="e.g. Lagos (for onsite / hybrid)"
    />
    <div className="grid grid-cols-2 gap-4">
      <Input label="Price (₦)" type="number" placeholder="45000" />
      <Input label="Duration (weeks)" type="number" placeholder="10" />
    </div>
    <Textarea label="Overview" rows={3} placeholder="What will learners get out of this?" />
  </>
);

export default function AdminCoursesPage() {
  return (
    <AdminCrud
      title="Courses"
      subtitle="Create and manage the course catalog."
      newLabel="New course"
      noun="course"
      columns={["Title", "Field", "Delivery", "Price", "Length"]}
      rows={rows}
      form={form}
    />
  );
}
