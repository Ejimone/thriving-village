"use client";

import { useState } from "react";
import { Gauge, Star, Trash2, RotateCcw, Plus, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { toast } from "@/components/ui/Toaster";
import { PageHeading, StatGrid, SectionCard } from "@/components/academy/Panels";
import { useCohort, FRONTEND_ID } from "@/components/academy/CohortProvider";
import { COHORT, ROSTER, liveRoster, paceCompletion } from "@/lib/cohort";

export default function GatePage() {
  const {
    course,
    threshold,
    setThreshold,
    removed,
    removeStudent,
    removeStudents,
    restoreStudent,
    isShortlisted,
    toggleShortlist,
  } = useCohort();

  const c = course(FRONTEND_ID);
  const releasedDay = c.releasedWeek * 7; // the cohort's expected pace
  const roster = liveRoster(c.currentDay - 1, removed);
  const binned = ROSTER.filter((s) => removed.includes(s.id));

  const [minInput, setMinInput] = useState(String(threshold.minCompletion));
  const [weekInput, setWeekInput] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const completionOf = (dayReached: number) => paceCompletion(dayReached, releasedDay);
  const meets = (dayReached: number) => completionOf(dayReached) >= threshold.minCompletion;
  const belowList = roster.filter((s) => !meets(s.dayReached));
  const below = belowList.length;

  const toggleSel = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selectBelowBar = () => setSelected(belowList.map((s) => s.id));
  const clearSel = () => setSelected([]);
  const removeSelected = () => {
    const n = selected.length;
    removeStudents(selected);
    setSelected([]);
    toast.success(`${n} student${n === 1 ? "" : "s"} moved to the bin.`);
  };

  const saveMin = () => {
    const n = Math.max(0, Math.min(100, parseInt(minInput, 10) || 0));
    setThreshold({ ...threshold, minCompletion: n });
    setMinInput(String(n));
    toast.success(`Threshold set to ${n}% of expected pace.`);
  };

  const addWeek = () => {
    const w = parseInt(weekInput, 10);
    if (!w || w < 1 || w > COHORT.weeksTotal) {
      toast.error(`Enter a week between 1 and ${COHORT.weeksTotal}.`);
      return;
    }
    if (threshold.checkWeeks.includes(w)) {
      toast.error(`Week ${w} is already a checkpoint.`);
      return;
    }
    setThreshold({ ...threshold, checkWeeks: [...threshold.checkWeeks, w].sort((a, b) => a - b) });
    setWeekInput("");
  };

  const removeWeek = (w: number) =>
    setThreshold({ ...threshold, checkWeeks: threshold.checkWeeks.filter((x) => x !== w) });

  return (
    <div>
      <PageHeading
        title="Performance gate"
        subtitle="Set the bar and the checkpoints. Students below the bar at a checkpoint can be flagged or removed."
      />

      {/* Threshold settings */}
      <SectionCard title="Threshold & check dates" className="mb-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <div className="sm:w-[260px]">
            <div className="flex items-end gap-2">
              <Input
                label="Minimum completion (% of expected pace)"
                type="number"
                min={0}
                max={100}
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
              />
              <Button variant="outline" onClick={saveMin}>
                Set
              </Button>
            </div>
          </div>

          <div className="flex-1">
            <p className="mb-1.5 text-sm font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
              Checkpoints (weeks)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {threshold.checkWeeks.length === 0 && (
                <span className="text-[13px] text-gray-400">No checkpoints set.</span>
              )}
              {threshold.checkWeeks.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-gray-300 bg-white py-1 pl-3 pr-1.5 text-[13px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]"
                >
                  Week {w}
                  <button
                    type="button"
                    aria-label={`Remove week ${w}`}
                    onClick={() => removeWeek(w)}
                    className="flex h-4 w-4 items-center justify-center rounded-pill text-gray-400 hover:bg-gray-100 hover:text-black"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <span className="inline-flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={COHORT.weeksTotal}
                  value={weekInput}
                  onChange={(e) => setWeekInput(e.target.value)}
                  placeholder="Wk"
                  className="w-[56px] rounded-sm border-[1.5px] border-gray-300 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-black [letter-spacing:var(--tv-track-tight)]"
                />
                <button
                  type="button"
                  aria-label="Add checkpoint week"
                  onClick={addWeek}
                  className="flex h-7 w-7 items-center justify-center rounded-pill border border-gray-300 text-gray-600 hover:border-black hover:text-black"
                >
                  <Plus size={14} />
                </button>
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      <StatGrid
        stats={[
          { label: "Threshold", value: `${threshold.minCompletion}%` },
          { label: "Checkpoints", value: threshold.checkWeeks.join(", ") || "—" },
          { label: "Below bar", value: String(below) },
          { label: "In the bin", value: String(removed.length) },
        ]}
      />

      <div className="mt-6">
        <SectionCard
          title="Students"
          action={
            <button
              type="button"
              onClick={selectBelowBar}
              className="text-[13px] font-semibold text-black hover:text-gray-600 [letter-spacing:var(--tv-track-tight)]"
            >
              Select all below bar
            </button>
          }
        >
          {/* Bulk-action toolbar */}
          {selected.length > 0 && (
            <div className="-mt-1 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-black px-4 py-2.5 text-white">
              <span className="text-[13px] font-semibold [letter-spacing:var(--tv-track-tight)]">
                {selected.length} selected
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearSel}
                  className="text-[13px] font-medium text-white/70 hover:text-white [letter-spacing:var(--tv-track-tight)]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={removeSelected}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-white px-3.5 py-1.5 text-[13px] font-semibold text-black hover:bg-gray-100 [letter-spacing:var(--tv-track-tight)]"
                >
                  <Trash2 size={14} /> Remove selected
                </button>
              </span>
            </div>
          )}

          <p className="mb-1 inline-flex items-center gap-1.5 text-[12px] text-gray-400">
            <Gauge size={13} /> Measured against Week {c.releasedWeek} pace
          </p>

          <ul className="flex flex-col">
            {roster.map((s) => {
              const completion = completionOf(s.dayReached);
              const ok = meets(s.dayReached);
              const checked = selected.includes(s.id);
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-gray-150 py-3.5 first:border-t-0"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSel(s.id)}
                    aria-label={`Select ${s.name}`}
                    className="h-4 w-4 shrink-0 accent-black"
                  />
                  <span className="flex min-w-[170px] flex-1 items-center gap-2.5">
                    <Avatar name={s.name} size={30} />
                    <span className="text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                      {s.name}
                    </span>
                    {isShortlisted(s.id) && <Star size={13} className="fill-black text-black" />}
                  </span>
                  <span className="flex w-[150px] items-center gap-2">
                    <ProgressBar value={completion} className="w-20" />
                    <span className="text-[13px] font-semibold text-gray-600 tabular-nums">
                      {completion}%
                    </span>
                  </span>
                  <Badge tone={ok ? "outline" : "inverse"} size="sm" className="w-[84px] justify-center">
                    {ok ? "Meets bar" : "Below bar"}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={isShortlisted(s.id) ? "primary" : "outline"}
                      iconLeft={<Star size={14} className={isShortlisted(s.id) ? "fill-white" : ""} />}
                      onClick={() => {
                        toggleShortlist(s.id);
                        toast.success(
                          isShortlisted(s.id) ? "Removed from shortlist." : `${s.name.split(" ")[0]} shortlisted.`,
                        );
                      }}
                    >
                      {isShortlisted(s.id) ? "Shortlisted" : "Shortlist"}
                    </Button>
                    <Button
                      size="sm"
                      variant="text"
                      iconLeft={<Trash2 size={14} />}
                      onClick={() => {
                        removeStudent(s.id);
                        toast.success(`${s.name.split(" ")[0]} moved to the bin.`);
                      }}
                    >
                      Remove
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>

      {/* Bin */}
      {binned.length > 0 && (
        <div className="mt-6">
          <SectionCard title={`Bin · ${binned.length}`}>
            <ul className="flex flex-col">
              {binned.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 border-t border-gray-150 py-3 first:border-t-0"
                >
                  <Avatar name={s.name} size={28} />
                  <span className="flex-1 text-[14px] font-medium text-gray-500 line-through [letter-spacing:var(--tv-track-tight)]">
                    {s.name}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    iconLeft={<RotateCcw size={14} />}
                    onClick={() => {
                      restoreStudent(s.id);
                      toast.success(`${s.name.split(" ")[0]} restored.`);
                    }}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
