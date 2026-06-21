import { ContestsAdmin } from "@/components/admin/ContestsAdmin";
import { getContests } from "@/lib/data";

export default async function AdminContestsPage() {
  const { items: contests } = await getContests({ pageSize: 50 });
  return <ContestsAdmin contests={contests} />;
}
