"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toaster";

export type AdminRow = {
  id: string;
  cells: React.ReactNode[];
};

/**
 * Generic admin list with create / edit / delete.
 * UI only — actions just toast. The dev team wires real mutations.
 */
export function AdminCrud({
  title,
  subtitle,
  newLabel,
  columns,
  rows,
  form,
  noun,
}: {
  title: string;
  subtitle: string;
  newLabel: string;
  columns: string[];
  rows: AdminRow[];
  /** Form body shown in the create/edit modal. */
  form: React.ReactNode;
  /** Singular noun for toasts, e.g. "job". */
  noun: string;
}) {
  const [mode, setMode] = useState<null | { kind: "new" | "edit"; label?: string }>(
    null,
  );

  function save() {
    const kind = mode?.kind;
    setMode(null);
    toast.success(
      kind === "new" ? `New ${noun} created.` : `${noun[0].toUpperCase()}${noun.slice(1)} updated.`,
    );
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
          onClick={() => setMode({ kind: "new" })}
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
                      onClick={() => setMode({ kind: "edit", label: String(row.cells[0]) })}
                    >
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${noun}`}
                      onClick={() => toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} deleted.`)}
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
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode?.kind === "edit" ? `Edit ${noun}` : `${newLabel}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button variant="inverse" size="sm" onClick={save}>
              {mode?.kind === "edit" ? "Save changes" : "Create"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">{form}</div>
      </Modal>
    </div>
  );
}
