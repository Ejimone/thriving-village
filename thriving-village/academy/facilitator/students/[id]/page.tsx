"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Star,
  Trash2,
  RotateCcw,
  ExternalLink,
  Check,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { PageHeading, StatGrid, SectionCard } from "@/components/academy/Panels";
import { useCohort, FRONTEND_ID } from "@/components/academy/CohortProvider";
import {
  COHORT,
  ME_STUDENT_ID,
  SCORE_CRITERIA,
  STANDING_LABEL,
  getStudent,
  studentSubmissions,
  studentJudgments,
  studentAvgScore,
  weekOf,
} from "@/lib/cohort";

export default function StudentProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    course,
    isShortlisted,
    toggleShortlist,
    isRemoved,
    removeStudent,
    restoreStudent,
  } = useCohort();

  const base = getStudent(id);
  if (!base) notFound();

  // The signed-in student's progress is live.
  const student =
    id === ME_STUDENT_ID
      ? { ...base, dayReached: Math.max(0, course(FRONTEND_ID).currentDay - 1) }
      : base;

  const submissions = studentSubmissions(student);
  const judgments = studentJudgments(student);
  const avg = studentAvgScore(student);
  const pct = Math.round((student.dayReached / COHORT.daysTotal) * 100);
  const shortlisted = isShortlisted(id);
  const removed = isRemoved(id);

  return (
    <div>
      <Link
        href="/academy/facilitator"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-black [letter-spacing:var(--tv-track-tight)]"
      >
        <ArrowLeft size={16} /> {COHORT.name}
      </Link>

      <PageHeading title={student.name} subtitle={COHORT.name}>
        <Button
          size="sm"
          variant={shortlisted ? "primary" : "outline"}
          iconLeft={<Star size={15} className={shortlisted ? "fill-white" : ""} />}
          onClick={() => {
            toggleShortlist(id);
            toast.success(shortlisted ? "Removed from shortlist." : `${student.name.split(" ")[0]} shortlisted.`);
          }}
        >
          {shortlisted ? "Shortlisted" : "Shortlist"}
        </Button>
        {removed ? (
          <Button
            size="sm"
            variant="outline"
            iconLeft={<RotateCcw size={15} />}
            onClick={() => {
              restoreStudent(id);
              toast.success(`${student.name.split(" ")[0]} restored to the cohort.`);
            }}
          >
            Restore
          </Button>
        ) : (
          <Button
            size="sm"
            variant="text"
            iconLeft={<Trash2 size={15} />}
            onClick={() => {
              removeStudent(id);
              toast.success(`${student.name.split(" ")[0]} moved to the bin.`);
            }}
          >
            Remove
          </Button>
        )}
      </PageHeading>

      {removed && (
        <div className="mb-5 flex items-center gap-2.5 rounded-card border border-gray-300 bg-gray-50 px-5 py-3.5 text-[14px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
          <Trash2 size={16} className="text-gray-400" /> This student is in the bin for
          this cohort. They no longer appear on the roster.
        </div>
      )}

      <div className="mb-5 flex items-center gap-3">
        <Avatar name={student.name} size={44} />
        <div>
          <Badge tone={student.standing === "on-track" ? "outline" : "neutral"} size="sm">
            {STANDING_LABEL[student.standing]}
          </Badge>
        </div>
      </div>

      <StatGrid
        stats={[
          { label: "Progress", value: `${pct}%`, note: `Day ${student.dayReached} of ${COHORT.daysTotal}` },
          { label: "Current week", value: `Wk ${weekOf(student.dayReached)}` },
          { label: "Submitted", value: String(submissions.length) },
          { label: "Avg. judge score", value: avg ? `${avg}/5` : "—" },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Submitted assignments */}
        <SectionCard title="Submitted assignments">
          <ul className="flex flex-col">
            {submissions.map((sub) => (
              <li
                key={sub.day}
                className="flex items-center gap-3 border-t border-gray-150 py-3 first:border-t-0"
              >
                <span className="w-[52px] shrink-0 text-[13px] font-semibold text-gray-500 tabular-nums">
                  Day {sub.day}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                    {sub.task}
                  </p>
                  <p className="text-[12px] text-gray-400">{sub.submittedAgo}</p>
                </div>
                {sub.rated && <Badge tone="neutral" size="sm">Rated</Badge>}
                <a
                  href={sub.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-300 transition-colors hover:text-black"
                  aria-label="Open submission"
                >
                  <ExternalLink size={15} />
                </a>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Judgments */}
        <SectionCard title="Judgments">
          {judgments.length === 0 ? (
            <p className="text-[14px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
              No work has been rated yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {judgments.map((j, i) => (
                <li key={i} className="border-t border-gray-150 pt-4 first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                      {j.task}
                    </p>
                    <span className="flex shrink-0 items-center gap-1 text-[13px] font-bold text-black">
                      <Star size={13} className="fill-black text-black" /> {j.average}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-gray-400">
                    Rated anonymously as {j.entry}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {SCORE_CRITERIA.map((cr) => (
                      <span key={cr.id} className="text-[12px] text-gray-500">
                        {cr.label}:{" "}
                        <span className="font-semibold text-gray-700 tabular-nums">
                          {j.scores[cr.id]}/5
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-relaxed text-gray-600 [letter-spacing:var(--tv-track-tight)]">
                    <Check size={13} className="mt-1 shrink-0 text-gray-400" /> {j.feedback}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
