"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 whitespace-nowrap rounded-sm px-3.5 py-2.5 text-[15px] [letter-spacing:var(--tv-track-tight)] transition-colors",
              active
                ? "bg-black text-white font-semibold"
                : "text-gray-700 font-medium hover:bg-gray-100",
            )}
          >
            <span className={active ? "text-white" : "text-gray-400"}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
