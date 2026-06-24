"use client";

import { useState } from "react";
import {
  Star,
  ExternalLink,
  EyeOff,
  Check,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toaster";
import { JUDGE_QUEUE, SCORE_CRITERIA, type JudgeSubmission } from "@/lib/cohort";
import { cn } from "@/lib/utils";

type Rating = { scores: Record<string, number>; feedback: string };

export default function JudgePage() {
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [selectedId, setSelectedId] = useState<string>(JUDGE_QUEUE[0].id);

  const pending = JUDGE_QUEUE.filter((s) => !ratings[s.id]);
  const rated = JUDGE_QUEUE.filter((s) => ratings[s.id]);
  const selected = JUDGE_QUEUE.find((s) => s.id === selectedId) ?? pending[0];

  return (
    <div className="tv-container py-8">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          <EyeOff size={15} className="text-gray-400" />
          Submissions are anonymous. You won&apos;t see who made the work, or other
          judges&apos; scores.
        </div>
        <h1 className="mb-7 text-[clamp(24px,4vw,32px)] font-bold leading-tight text-black [letter-spacing:var(--tv-track-tighter)]">
          Rating queue
        </h1>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Queue list */}
          <div className="flex flex-col gap-5">
            <QueueList
              title={`To rate · ${pending.length}`}
              items={pending}
              selectedId={selected?.id}
              onSelect={setSelectedId}
            />
            {rated.length > 0 && (
              <QueueList
                title={`Rated · ${rated.length}`}
                items={rated}
                selectedId={selected?.id}
                onSelect={setSelectedId}
                muted
              />
            )}
          </div>

          {/* Scoring panel */}
          {selected ? (
            <ScorePanel
              key={selected.id}
              submission={selected}
              existing={ratings[selected.id]}
              onSubmit={(rating) => {
                setRatings((r) => ({ ...r, [selected.id]: rating }));
                toast.success(`${selected.id} rated.`);
                const next = pending.find((p) => p.id !== selected.id);
                if (next) setSelectedId(next.id);
              }}
            />
          ) : (
            <EmptyState
              icon={<Check size={20} />}
              title="Queue clear"
              body="You've rated everything waiting. New submissions will appear here."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function QueueList({
  title,
  items,
  selectedId,
  onSelect,
  muted,
}: {
  title: string;
  items: JudgeSubmission[];
  selectedId?: string;
  onSelect: (id: string) => void;
  muted?: boolean;
}) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((s) => {
          const active = s.id === selectedId;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className={cn(
                  "w-full rounded-sm border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-black bg-black text-white"
                    : "border-gray-200 bg-white hover:border-gray-400",
                  muted && !active && "opacity-60",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold [letter-spacing:var(--tv-track-tight)]">
                    {s.id}
                  </span>
                  <span className={cn("text-[12px]", active ? "text-white/60" : "text-gray-400")}>
                    {s.submittedAgo}
                  </span>
                </span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-[13px]",
                    active ? "text-white/75" : "text-gray-500",
                  )}
                >
                  {s.course}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScorePanel({
  submission,
  existing,
  onSubmit,
}: {
  submission: JudgeSubmission;
  existing?: Rating;
  onSubmit: (rating: Rating) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(
    existing?.scores ?? {},
  );
  const [feedback, setFeedback] = useState(existing?.feedback ?? "");

  const done = !!existing;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (SCORE_CRITERIA.some((c) => !scores[c.id])) {
      toast.error("Score every criterion before you submit.");
      return;
    }
    if (!feedback.trim()) {
      toast.error("Add a line of feedback for the maker.");
      return;
    }
    onSubmit({ scores, feedback: feedback.trim() });
  }

  return (
    <div className="rounded-card border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
            {submission.course} · Week {submission.week}
          </p>
          <h2 className="mt-1 text-[22px] font-bold leading-tight text-black [letter-spacing:var(--tv-track-tighter)]">
            {submission.id}
          </h2>
        </div>
        {done && <Badge tone="neutral" size="sm">Rated</Badge>}
      </div>

      <div className="flex flex-col gap-6 px-6 py-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
            Task
          </p>
          <p className="mt-1.5 text-[16px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
            {submission.task}
          </p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.05em] text-gray-400">
            Maker&apos;s note
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600 [letter-spacing:var(--tv-track-tight)]">
            {submission.note}
          </p>
        </div>

        <a
          href={submission.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-sm border border-gray-300 bg-white px-4 py-2.5 text-[14px] font-semibold text-black transition-colors hover:border-black [letter-spacing:var(--tv-track-tight)]"
        >
          Open the work
          <ExternalLink size={15} className="text-gray-400" />
        </a>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 border-t border-gray-200 pt-6">
          {SCORE_CRITERIA.map((cr) => (
            <div key={cr.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                  {cr.label}
                </p>
                <p className="text-[13px] text-gray-500">{cr.hint}</p>
              </div>
              <Stars
                value={scores[cr.id] ?? 0}
                disabled={done}
                onChange={(v) => setScores((s) => ({ ...s, [cr.id]: v }))}
              />
            </div>
          ))}

          <Textarea
            label="Feedback for the maker"
            placeholder="What worked, and one thing to push further."
            value={feedback}
            disabled={done}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
          />

          {!done && (
            <div>
              <Button type="submit" variant="inverse" iconRight={<ArrowRight size={18} />}>
                Submit rating
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function Stars({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`${n} out of 5`}
          onClick={() => onChange(n)}
          className={cn(
            "p-0.5 transition-colors",
            disabled ? "cursor-default" : "cursor-pointer hover:scale-110",
          )}
        >
          <Star
            size={22}
            className={n <= value ? "fill-black text-black" : "text-gray-300"}
          />
        </button>
      ))}
    </div>
  );
}
