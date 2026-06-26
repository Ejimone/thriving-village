import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JobApplicantsList } from "@/components/admin/JobApplicantsList";
import { getJob, getJobApplicants } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function JobApplicantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/auth/signin");

  const [job, applicants] = await Promise.all([getJob(id, session.jwt), getJobApplicants(id, session.jwt)]);
  if (!job) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/jobs"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-black [letter-spacing:var(--tv-track-tight)]"
        >
          <ArrowLeft size={16} /> All jobs
        </Link>
        <h1 className="mt-3 text-[clamp(26px,4vw,32px)] font-bold text-black [letter-spacing:var(--tv-track-tighter)]">
          {job.title}
        </h1>
        <p className="mt-2 text-[16px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
          {applicants.length} {applicants.length === 1 ? "applicant" : "applicants"}
        </p>
      </div>

      <JobApplicantsList applicants={applicants} />
    </div>
  );
}
