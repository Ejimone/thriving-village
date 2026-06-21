"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toaster";

export type AdminRow = {
  id: string; // documentId
  label: string; // used in delete confirmation + toasts
  cells: React.ReactNode[];
};

type SaveResult = { error?: string; success?: boolean };

/** Generic admin list with create / edit / delete, backed by real Server Actions. */
export function AdminCrud({
  title,
  subtitle,
  newLabel,
  columns,
  rows,
  renderForm,
  onSave,
  onDelete,
  noun,
}: {
  title: string;
  subtitle: string;
  newLabel: string;
  columns: string[];
  rows: AdminRow[];
  /** Form fields for create (documentId null) or edit (documentId set). */
  renderForm: (documentId: string | null) => React.ReactNode;
  onSave: (documentId: string | null, formData: FormData) => Promise<SaveResult>;
  onDelete: (documentId: string) => Promise<SaveResult>;
  /** Singular noun for toasts, e.g. "job". */
  noun: string;
}) {
  const [editing, setEditing] = useState<null | { kind: "new" } | { kind: "edit"; id: string }>(null);
  const formId = useId();
  const [deleting, startDelete] = useTransition();

  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    async (_prev, formData) => onSave(editing?.kind === "edit" ? editing.id : null, formData),
    {},
  );

  useEffect(() => {
    if (state.success) {
      const wasNew = editing?.kind === "new";
      setEditing(null);
      toast.success(wasNew ? `New ${noun} created.` : `${noun[0].toUpperCase()}${noun.slice(1)} updated.`);
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleDelete(row: AdminRow) {
    if (!window.confirm(`Delete "${row.label}"? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await onDelete(row.id);
      if (result.error) toast.error(result.error);
      else toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} deleted.`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(26px,4vw,32px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
            {title}
          </h1>
          <p className="mt-2 text-[16px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            {subtitle}
          </p>
        </div>
        <Button
          variant="inverse"
          iconLeft={<Plus size={18} />}
          onClick={() => setEditing({ kind: "new" })}
        >
          {newLabel}
        </Button>
      </div>

      <Card variant="flat" className="!p-0 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map((c) => (
                <th
                  key={c}
                  className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[0.05em] text-gray-500"
                >
                  {c}
                </th>
              ))}
              <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-[0.05em] text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-gray-150 last:border-0 hover:bg-gray-50"
              >
                {row.cells.map((cell, i) => (
                  <td
                    key={i}
                    className="px-5 py-4 text-[15px] text-gray-800 [letter-spacing:var(--tv-track-tight)]"
                  >
                    {cell}
                  </td>
                ))}
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${noun}`}
                      onClick={() => setEditing({ kind: "edit", id: row.id })}
                    >
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${noun}`}
                      disabled={deleting}
                      onClick={() => handleDelete(row)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.kind === "edit" ? `Edit ${noun}` : newLabel}
        footer={
          <>
            <Button variant="outline" size="sm" type="button" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="inverse" size="sm" type="submit" form={formId} disabled={pending}>
              {pending ? "Saving…" : editing?.kind === "edit" ? "Save changes" : "Create"}
            </Button>
          </>
        }
      >
        {editing && (
          <form id={formId} action={formAction} className="flex flex-col gap-4">
            {renderForm(editing.kind === "edit" ? editing.id : null)}
          </form>
        )}
      </Modal>
    </div>
  );
}
