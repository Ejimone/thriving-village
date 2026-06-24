import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SidebarNav, type NavItem } from "@/components/layout/SidebarNav";

/** Shared chrome for authenticated areas (dashboard + admin). */
export function AppShell({
  items,
  areaLabel,
  userName,
  children,
}: {
  items: NavItem[];
  areaLabel: string;
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-[rgba(250,250,248,0.82)] backdrop-blur-[12px]">
        <div className="tv-container flex h-[72px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Thriving Village home">
              <Logo variant="lockup" height={26} />
            </Link>
            <Badge tone="neutral" size="sm">
              {areaLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button href="/" variant="text" size="sm">
              View site
            </Button>
            <Avatar name={userName} size={36} />
          </div>
        </div>
      </header>

      <div className="tv-container flex-1 py-8">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-[88px] lg:self-start">
            <SidebarNav items={items} />
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </>
  );
}
