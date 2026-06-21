import { JobsAdmin } from "@/components/admin/JobsAdmin";
import { getJobs } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function AdminJobsPage() {
  const session = await getSession();
  const { items: jobs } = await getJobs({ pageSize: 50, full: true, token: session?.jwt });
  return <JobsAdmin jobs={jobs} />;
}
