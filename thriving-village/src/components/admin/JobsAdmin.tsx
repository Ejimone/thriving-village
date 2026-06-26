"use client";

import { Badge } from "@/components/ui/Badge";
import { AdminCrud, PENDING_NEW_ID, type AdminRow } from "@/components/admin/AdminCrud";
import { JobFormFields } from "@/components/admin/JobFormFields";
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
      <span key="title" className="font-semibold text-black">
        {j.title}
      </span>,
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
    return <JobFormFields job={job} />;
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
      getRowHref={(row) => `/admin/jobs/${byId.get(row.id)?.id ?? ""}`}
      hideActions
    />
  );
}
