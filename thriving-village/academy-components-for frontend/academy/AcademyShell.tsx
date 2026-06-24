"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Gauge,
  CalendarClock,
  FolderTree,
  Layers,
  Users,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SidebarNav, type NavItem } from "@/components/layout/SidebarNav";
import { RoleSwitcher } from "@/components/academy/RoleSwitcher";
import { ME, COHORT, type Role } from "@/lib/cohort";

const FACILITATOR_NAV: NavItem[] = [
  { href: "/academy/facilitator", label: "My cohorts", icon: <LayoutDashboard size={18} />, exact: true },
  { href: "/academy/facilitator/course", label: "Course manager", icon: <FolderTree size={18} /> },
  { href: "/academy/facilitator/gate", label: "Performance gate", icon: <Gauge size={18} /> },
  { href: "/academy/facilitator/teams", label: "Teams", icon: <Users size={18} /> },
  { href: "/academy/facilitator/schedule", label: "Calls & workshops", icon: <CalendarClock size={18} /> },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/academy/admin", label: "Overview", icon: <LayoutDashboard size={18} />, exact: true },
  { href: "/academy/admin/curriculum", label: "Curriculum", icon: <FolderTree size={18} /> },
  { href: "/academy/admin/cohorts", label: "Cohorts", icon: <Layers size={18} /> },
];

function roleFromPath(pathname: string): Role {
  if (pathname.startsWith("/academy/facilitator")) return "facilitator";
  if (pathname.startsWith("/academy/judge")) return "judge";
  if (pathname.startsWith("/academy/admin")) return "admin";
  return "student";
}

const USER_NAME: Record<Role, string> = {
  student: ME.name,
  facilitator: COHORT.facilitator,
  judge: "Judge",
  admin: "Admin",
};

export function AcademyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const role = roleFromPath(pathname);

  const nav =
    role === "facilitator" ? FACILITATOR_NAV : role === "admin" ? ADMIN_NAV : null;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-[rgba(250,250,248,0.82)] backdrop-blur-[12px]">
        <div className="tv-container flex h-[72px] items-center justify-between gap-4">
          {/* The Academy is its own property — the mark links to the academy
              home, never back to the main marketing site. */}
          <Link
            href={`/academy/${role}`}
            aria-label="Thriving Village Academy"
            className="flex items-center gap-3"
          >
            <Logo variant="lockup" height={24} />
            <Badge tone="neutral" size="sm">
              Academy
            </Badge>
          </Link>
          <div className="flex items-center gap-3">
            <RoleSwitcher role={role} />
            <Button href="/academy" variant="text" size="sm">
              Sign out
            </Button>
            <Avatar name={USER_NAME[role]} size={36} />
          </div>
        </div>
      </header>

      {nav ? (
        <div className="tv-container flex-1 py-8">
          <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
            <aside className="lg:sticky lg:top-[88px] lg:self-start">
              <SidebarNav items={nav} />
            </aside>
            <div className="min-w-0">{children}</div>
          </div>
        </div>
      ) : (
        <main className="flex-1">{children}</main>
      )}
    </>
  );
}
