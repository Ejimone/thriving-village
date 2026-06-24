"use client";

import { useState } from "react";
import { Shuffle, Users, Mail, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toaster";
import { PageHeading, SectionCard } from "@/components/academy/Panels";
import { useCohort } from "@/components/academy/CohortProvider";
import {
  GROUP_ASSIGNMENT,
  getStudent,
  studentEmail,
  studentWhatsapp,
  whatsappLink,
} from "@/lib/cohort";

export default function TeamsPage() {
  const { teams, teamSize, matchTeams, clearTeams } = useCohort();
  const [size, setSize] = useState(String(teamSize));

  const match = () => {
    matchTeams(parseInt(size, 10));
    toast.success("Teams matched. Students can now see their teammates.");
  };

  return (
    <div>
      <PageHeading
        title="Teams"
        subtitle={`Match students into teams for ${GROUP_ASSIGNMENT.title}. Each student then sees only their teammates' name, email, and WhatsApp.`}
      >
        <div className="w-[130px]">
          <Select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            options={[
              { label: "Teams of 2", value: "2" },
              { label: "Teams of 3", value: "3" },
              { label: "Teams of 4", value: "4" },
            ]}
          />
        </div>
        <Button variant="inverse" iconLeft={<Shuffle size={17} />} onClick={match}>
          {teams.length ? "Re-match" : "Match teams"}
        </Button>
      </PageHeading>

      {teams.length === 0 ? (
        <EmptyState
          icon={<Users size={20} />}
          title="No teams yet"
          body="Pick a team size and match students. They'll see their teammates on their dashboard."
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[14px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
              {teams.length} teams · {GROUP_ASSIGNMENT.title}
            </p>
            <button
              type="button"
              onClick={() => {
                clearTeams();
                toast.success("Teams cleared.");
              }}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 hover:text-black [letter-spacing:var(--tv-track-tight)]"
            >
              <X size={14} /> Clear teams
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team, i) => (
              <SectionCard key={i} title={`Team ${i + 1}`}>
                <ul className="flex flex-col gap-4">
                  {team.map((id) => {
                    const s = getStudent(id);
                    if (!s) return null;
                    return (
                      <li key={id} className="flex flex-col gap-1">
                        <span className="text-[14px] font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                          {s.name}
                        </span>
                        <a
                          href={`mailto:${studentEmail(s)}`}
                          className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 underline-offset-4 hover:text-black hover:underline"
                        >
                          <Mail size={12} className="shrink-0 text-gray-400" />
                          {studentEmail(s)}
                        </a>
                        <a
                          href={whatsappLink(s)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 underline-offset-4 hover:text-black hover:underline"
                        >
                          <Phone size={12} className="shrink-0 text-gray-400" />
                          {studentWhatsapp(s)}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
