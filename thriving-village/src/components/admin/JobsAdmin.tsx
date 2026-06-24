"use client";

import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { AdminCrud, PENDING_NEW_ID, type AdminRow } from "@/components/admin/AdminCrud";
import { saveJobAction, deleteJobAction } from "@/lib/actions/admin";
import type { Field, Job, LocationType } from "@/lib/data";

const blankJob: Job = {
  id: "",
  documentId: "",
  title: "",
  org: "",
  orgKind: "",
  field: "Digital",
  location: "",
  locationType: "Remote",
  type: "Full-time",
  level: "Entry",
  pay: "",
  postedAgo: "",
  summary: "",
  responsibilities: [],
  requirements: [],
};

function buildRow(j: Job): AdminRow {
  return {
    id: j.documentId,
    label: j.title,
    cells: [
      j.title,
      j.org,
      <Badge key="f" tone="neutral" size="sm">
        {j.field}
      </Badge>,
      `${j.location} · ${j.locationType}`,
      j.pay,
    ],
  };
}

export function JobsAdmin({ jobs }: { jobs: Job[] }) {
  const byId = new Map(jobs.map((j) => [j.documentId, j]));

  const rows: AdminRow[] = jobs.map(buildRow);

  function previewRow(documentId: string | null, formData: FormData): AdminRow {
    const existing = documentId ? byId.get(documentId) : undefined;
    const get = (k: string, fallback: string) => String(formData.get(k) ?? fallback);
    return buildRow({
      ...(existing ?? blankJob),
      documentId: documentId ?? PENDING_NEW_ID,
      title: get("title", existing?.title ?? ""),
      org: get("org", existing?.org ?? ""),
      field: get("field", existing?.field ?? "Digital") as Field,
      location: get("location", existing?.location ?? ""),
      locationType: get("locationType", existing?.locationType ?? "Remote") as LocationType,
      pay: get("pay", existing?.pay ?? ""),
    });
  }

  function renderForm(documentId: string | null) {
    const job = documentId ? byId.get(documentId) : undefined;
    return (
      <>
        <Input name="title" label="Job title" placeholder="e.g. Frontend Developer" defaultValue={job?.title} required />
        <Input name="org" label="Company / org" placeholder="e.g. Hubway Digital" defaultValue={job?.org} required />
        <Input name="orgKind" label="Org type" placeholder="e.g. Sister business" defaultValue={job?.orgKind} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            name="field"
            label="Field"
            defaultValue={job?.field}
            options={[
              { label: "Digital", value: "Digital" },
              { label: "Technical", value: "Technical" },
              { label: "Craft", value: "Craft" },
              { label: "Creative", value: "Creative" },
            ]}
          />
          <Select
            name="locationType"
            label="Location type"
            defaultValue={job?.locationType}
            options={[
              { label: "Remote", value: "Remote" },
              { label: "Onsite", value: "Onsite" },
              { label: "Hybrid", value: "Hybrid" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            name="type"
            label="Employment type"
            defaultValue={job?.type}
            options={[
              { label: "Full-time", value: "Full-time" },
              { label: "Part-time", value: "Part-time" },
              { label: "Contract", value: "Contract" },
            ]}
          />
          <Select
            name="level"
            label="Level"
            defaultValue={job?.level}
            options={[
              { label: "Entry", value: "Entry" },
              { label: "Mid", value: "Mid" },
              { label: "Senior", value: "Senior" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input name="location" label="Location" placeholder="e.g. Lagos" defaultValue={job?.location} required />
          <Input name="pay" label="Pay" placeholder="e.g. ₦450k–700k / mo" defaultValue={job?.pay} required />
        </div>
        <Select
          name="status"
          label="Status"
          defaultValue={job?.status ?? "published"}
          options={[
            { label: "Draft", value: "draft" },
            { label: "Published", value: "published" },
            { label: "Closed", value: "closed" },
          ]}
        />
        <Textarea
          name="summary"
          label="Summary"
          rows={3}
          placeholder="Short, plain description of the role."
          defaultValue={job?.summary}
          required
        />
        <Textarea
          name="responsibilities"
          label="Responsibilities (one per line)"
          rows={4}
          placeholder={"Build and ship features\nReview pull requests"}
          defaultValue={job?.responsibilities.join("\n")}
        />
        <Textarea
          name="requirements"
          label="Requirements (one per line)"
          rows={4}
          placeholder={"2+ years experience\nComfortable with React"}
          defaultValue={job?.requirements.join("\n")}
        />
      </>
    );
  }

  return (
    <AdminCrud
      title="Jobs"
      subtitle="Create and manage roles on the job board."
      newLabel="New job"
      noun="job"
      columns={["Title", "Company", "Field", "Location", "Pay"]}
      rows={rows}
      renderForm={renderForm}
      onSave={saveJobAction}
      onDelete={deleteJobAction}
      previewRow={previewRow}
    />
  );
}
