import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Trophy,
  GraduationCap,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/SidebarNav";
import { getSession } from "@/lib/session";

const ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: <LayoutDashboard size={18} />, exact: true },
  { href: "/admin/jobs", label: "Jobs", icon: <Briefcase size={18} /> },
  { href: "/admin/contests", label: "Contests", icon: <Trophy size={18} /> },
  { href: "/admin/courses", label: "Courses", icon: <GraduationCap size={18} /> },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "Admin") redirect("/auth/signin");

  return (
    <AppShell items={ITEMS} areaLabel="Admin" userName={session.name}>
      {children}
    </AppShell>
  );
}
