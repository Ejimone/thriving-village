"use client";

import { Plus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { toast } from "@/components/ui/Toaster";
import { PageHeading, SectionCard } from "@/components/academy/Panels";
import { ADMIN_COHORTS, type AdminCohort } from "@/lib/cohort";

const statusTone: Record<AdminCohort["status"], "neutral" | "outline" | "inverse"> = {
  Running: "neutral",
  Enrolling: "outline",
  Completed: "inverse",
};

export default function CohortsPage() {
  return (
    <div>
      <PageHeading title="Cohorts" subtitle="Every cohort across the platform.">
        <Button
          size="sm"
          variant="inverse"
          iconLeft={<Plus size={16} />}
          onClick={() => toast.success("New cohort created as a draft.")}
        >
          New cohort
        </Button>
      </PageHeading>

      <SectionCard title={`${ADMIN_COHORTS.length} cohorts`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="text-left text-[12px] font-bold uppercase tracking-[0.04em] text-gray-400">
                <th className="pb-3 pr-4 font-bold">Cohort</th>
                <th className="pb-3 pr-4 font-bold">Facilitator</th>
                <th className="pb-3 pr-4 font-bold">Students</th>
                <th className="pb-3 pr-4 font-bold">Progress</th>
                <th className="pb-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {ADMIN_COHORTS.map((c) => {
                const pct = c.weeksTotal ? Math.round((c.week / c.weeksTotal) * 100) : 0;
                return (
                  <tr key={c.id} className="border-t border-gray-150 align-middle">
                    <td className="py-3 pr-4">
                      <p className="text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                        {c.course}
                      </p>
                      <p className="text-[13px] text-gray-500">{c.name}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-2 text-[14px] text-gray-700">
                        <Avatar name={c.facilitator} size={24} /> {c.facilitator}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[14px] text-gray-700 tabular-nums">
                      {c.students}
                    </td>
                    <td className="py-3 pr-4">
                      {c.status === "Enrolling" ? (
                        <span className="text-[13px] text-gray-400">Not started</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <ProgressBar value={pct} className="w-24" />
                          <span className="text-[13px] text-gray-500 tabular-nums">
                            Wk {c.week}/{c.weeksTotal}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <Badge tone={statusTone[c.status]} size="sm">
                        {c.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
