"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, MessageCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { WHATSAPP_URL } from "@/lib/data";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/jobs", label: "Jobs" },
  { href: "/contests", label: "Contests" },
  { href: "/courses", label: "Courses" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-[rgba(250,250,248,0.82)] backdrop-blur-[12px]">
      <div className="tv-container flex h-[72px] items-center justify-between gap-6">
        <Link href="/" aria-label="Thriving Village home" className="shrink-0">
          <Logo variant="lockup" height={28} />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "px-3.5 py-2 text-[15px] [letter-spacing:var(--tv-track-tight)] transition-colors",
                isActive(n.href)
                  ? "font-semibold text-black"
                  : "font-medium text-gray-500 hover:text-black",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2.5">
          <Button href="/auth/signin" variant="text" size="sm">
            Sign in
          </Button>
          <Button
            href={WHATSAPP_URL}
            variant="inverse"
            size="sm"
            iconLeft={<MessageCircle size={16} />}
          >
            Join on WhatsApp
          </Button>
        </div>

        {/* Mobile trigger */}
        <div className="md:hidden">
          <IconButton
            variant="ghost"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu size={22} />
          </IconButton>
        </div>
      </div>
      </header>

      {/* Mobile drawer — rendered outside <header> so its fixed positioning
          covers the viewport (a backdrop-filtered ancestor would otherwise
          constrain `fixed` to the header box). */}
      {open && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[82%] max-w-sm bg-paper shadow-lg flex flex-col">
            <div className="flex h-[72px] items-center justify-between px-6 border-b border-gray-200">
              <Logo variant="icon" height={28} />
              <IconButton
                variant="ghost"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X size={22} />
              </IconButton>
            </div>
            <nav className="flex flex-col p-4 gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-sm px-4 py-3 text-lg [letter-spacing:var(--tv-track-tight)]",
                    isActive(n.href)
                      ? "font-semibold text-black bg-gray-100"
                      : "font-medium text-gray-700 hover:bg-gray-100",
                  )}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-3 p-6 border-t border-gray-200">
              <Button
                href="/auth/signin"
                variant="outline"
                fullWidth
                onClick={() => setOpen(false)}
              >
                Sign in
              </Button>
              <Button
                href={WHATSAPP_URL}
                variant="inverse"
                fullWidth
                iconLeft={<MessageCircle size={18} />}
              >
                Join on WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
