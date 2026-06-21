import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  Briefcase,
  Trophy,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/SidebarNav";
import { getSession } from "@/lib/session";

const ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: <LayoutDashboard size={18} />,
    exact: true,
  },
  { href: "/dashboard/courses", label: "My courses", icon: <GraduationCap size={18} /> },
  {
    href: "/dashboard/applications",
    label: "Applications",
    icon: <Briefcase size={18} />,
  },
  { href: "/dashboard/contests", label: "Contest entries", icon: <Trophy size={18} /> },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/auth/signin");

  return (
    <AppShell items={ITEMS} areaLabel="Dashboard" userName={session.name}>
      {children}
    </AppShell>
  );
}
