import {
  LayoutDashboard,
  GraduationCap,
  Briefcase,
  Trophy,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/SidebarNav";

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell items={ITEMS} areaLabel="Dashboard" userName="Ada Okonkwo">
      {children}
    </AppShell>
  );
}
