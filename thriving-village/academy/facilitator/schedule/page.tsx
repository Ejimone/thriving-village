"use client";

import { useState } from "react";
import { Plus, Video, Presentation, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toaster";
import { PageHeading, SectionCard } from "@/components/academy/Panels";
import { COHORT, SESSIONS, type LiveSession } from "@/lib/cohort";

export default function SchedulePage() {
  const [sessions, setSessions] = useState<LiveSession[]>(SESSIONS);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<LiveSession["type"]>("Live call");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [link, setLink] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !day.trim() || !time.trim()) {
      toast.error("Give the session a title, day, and time.");
      return;
    }
    setSessions((s) => [
      ...s,
      {
        id: `s${Date.now()}`,
        title: title.trim(),
        type,
        day: day.trim(),
        time: time.trim(),
        host: COHORT.facilitator,
        link: link.trim() || undefined,
      },
    ]);
    setTitle("");
    setDay("");
    setTime("");
    setLink("");
    toast.success("Session scheduled. Students will see it — with the join link — on their dashboard.");
  }

  return (
    <div>
      <PageHeading
        title="Calls & workshops"
        subtitle="Schedule live sessions for the cohort. They appear on each student's main screen."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <SectionCard title="Scheduled">
          <ul className="flex flex-col">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-4 border-t border-gray-150 py-4 first:border-t-0"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-gray-100 text-gray-600">
                  {s.type === "Workshop" ? <Presentation size={18} /> : <Video size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                    {s.title}
                  </p>
                  <p className="flex items-center gap-1.5 text-[13px] text-gray-500">
                    <Clock size={13} /> {s.day} · {s.time}
                  </p>
                  {s.link ? (
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate text-[13px] font-medium text-black underline-offset-4 hover:underline [letter-spacing:var(--tv-track-tight)]"
                    >
                      <ExternalLink size={12} className="shrink-0 text-gray-400" />
                      <span className="truncate">{s.link}</span>
                    </a>
                  ) : (
                    <span className="mt-1 inline-block text-[12px] text-gray-400">
                      No link yet
                    </span>
                  )}
                </div>
                <Badge tone="outline" size="sm">{s.type}</Badge>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Schedule a session">
          <form onSubmit={add} className="flex flex-col gap-4">
            <Input
              label="Title"
              placeholder="e.g. Week 3 group call"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Select
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as LiveSession["type"])}
              options={[
                { label: "Live call", value: "Live call" },
                { label: "Workshop", value: "Workshop" },
              ]}
            />
            <Input
              label="Day"
              placeholder="e.g. Thursday"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
            <Input
              label="Time"
              placeholder="e.g. 6:00 PM WAT"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
            <Input
              label="Meeting link"
              hint="Zoom, Google Meet, or any join URL"
              placeholder="https://meet.google.com/…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              inputMode="url"
            />
            <Button type="submit" variant="inverse" iconLeft={<Plus size={18} />}>
              Add to schedule
            </Button>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
