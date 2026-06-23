import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { WHATSAPP_URL } from "@/lib/data";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Platform",
    links: [
      { label: "Jobs", href: "/jobs" },
      { label: "Contests", href: "/contests" },
      { label: "Courses", href: "/courses" },
      { label: "Shop", href: "/shop" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Brands", href: "/brands" },
      { label: "Partners", href: "/about#partners" },
      { label: "Contact", href: "/about#contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 bg-black text-white">
      <div className="tv-container py-16 pb-10">
        <div className="flex flex-wrap justify-between gap-10">
          <div className="max-w-[340px]">
            <Logo variant="lockup" color="white" height={28} />
            <p className="mt-4 text-[15px] leading-relaxed text-gray-400 [letter-spacing:var(--tv-track-tight)]">
              Connecting African talent to real opportunities. Our community lives
              on WhatsApp.
            </p>
            <div className="mt-5">
              <Button
                href={WHATSAPP_URL}
                variant="inverse"
                size="sm"
                iconLeft={<MessageCircle size={16} />}
                className="!bg-[#25D366] !border-[#25D366] !text-white hover:!bg-[#1DA851]"
              >
                Join the community
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-12 sm:gap-16">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="mb-3.5 text-xs font-bold uppercase tracking-[0.05em] text-gray-500">
                  {col.title}
                </p>
                <div className="flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <Link
                      key={l.label}
                      href={l.href}
                      className="text-[15px] text-gray-300 hover:text-white [letter-spacing:var(--tv-track-tight)]"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-between gap-3 border-t border-gray-800 pt-6 text-[13px] text-gray-500 [letter-spacing:var(--tv-track-tight)]">
          <span>© 2026 Thriving Village</span>
          <span>Lagos, Nigeria</span>
        </div>
      </div>
    </footer>
  );
}
