"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { JobFormFields } from "@/components/admin/JobFormFields";
import { JobApplicantsList } from "@/components/admin/JobApplicantsList";
import { saveJobAction, deleteJobAction } from "@/lib/actions/admin";
import type { Job, JobApplicant } from "@/lib/data";

type Tab = "details" | "applicants";
type SaveResult = { error?: string; success?: boolean };

export function JobDetailView({ job, applicants }: { job: Job; applicants: JobApplicant[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("details");
  const [editing, setEditing] = useState(false);
  const [deleting, startDelete] = useTransition();
  const formId = useId();

  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    async (_prev, formData) => saveJobAction(job.documentId, formData),
    {},
  );

  useEffect(() => {
    if (state.success) {
      setEditing(false);
      toast.success("Job updated.");
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleDelete() {
    if (!window.confirm(`Delete "${job.title}"? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deleteJobAction(job.documentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Job deleted.");
        router.push("/admin/jobs");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1 border-b border-gray-200">
        <TabButton active={tab === "details"} onClick={() => setTab("details")}>
          Details
        </TabButton>
        <TabButton active={tab === "applicants"} onClick={() => setTab("applicants")}>
          Applicants{applicants.length > 0 ? ` (${applicants.length})` : ""}
        </TabButton>
      </div>

      {tab === "applicants" ? (
        <JobApplicantsList applicants={applicants} />
      ) : editing ? (
        <form id={formId} action={formAction} className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <JobFormFields job={job} />
          </Card>
          <div className="flex gap-2.5">
            <Button type="submit" variant="inverse" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex justify-end gap-2.5">
            <Button
              variant="inverse"
              size="sm"
              iconLeft={<Pencil size={15} />}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Trash2 size={15} />}
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>

          <Card className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2.5">
              {job.status && (
                <Badge tone={job.status === "published" ? "neutral" : "outline"} size="sm">
                  {job.status}
                </Badge>
              )}
              <Badge tone="neutral" size="sm">
                {job.field}
              </Badge>
              <Badge tone="outline" size="sm">
                {job.level}
              </Badge>
              <Badge tone="outline" size="sm">
                {job.type}
              </Badge>
              <Badge tone="outline" size="sm">
                {job.locationType}
              </Badge>
            </div>

            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.05em] text-gray-500">Summary</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-800 [letter-spacing:var(--tv-track-tight)]">
                {job.summary}
              </p>
            </div>

            {job.responsibilities.length > 0 && (
              <DetailSection title="Responsibilities" items={job.responsibilities} />
            )}
            {job.requirements.length > 0 && (
              <DetailSection title="Requirements" items={job.requirements} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-semibold [letter-spacing:var(--tv-track-tight)] border-b-2 transition-colors ${
        active ? "border-black text-black" : "border-transparent text-gray-500 hover:text-black"
      }`}
    >
      {children}
    </button>
  );
}

function DetailSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-[0.05em] text-gray-500">{title}</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((it) => (
          <li
            key={it}
            className="flex items-start gap-2.5 text-[15px] text-gray-800 [letter-spacing:var(--tv-track-tight)]"
          >
            <Check size={16} className="mt-0.5 flex-none text-black" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
