import {
  LayoutDashboard,
  Briefcase,
  Trophy,
  GraduationCap,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem } from "@/components/layout/SidebarNav";

const ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: <LayoutDashboard size={18} />, exact: true },
  { href: "/admin/jobs", label: "Jobs", icon: <Briefcase size={18} /> },
  { href: "/admin/contests", label: "Contests", icon: <Trophy size={18} /> },
  { href: "/admin/courses", label: "Courses", icon: <GraduationCap size={18} /> },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell items={ITEMS} areaLabel="Admin" userName="Admin">
      {children}
    </AppShell>
  );
}
