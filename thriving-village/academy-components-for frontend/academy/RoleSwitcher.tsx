"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { ROLES, type Role } from "@/lib/cohort";
import { cn } from "@/lib/utils";

/**
 * Switches the viewer between the four roles. This is a review aid — it
 * navigates to each role's home. The current role is derived from the URL.
 */
export function RoleSwitcher({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = ROLES.find((r) => r.id === role) ?? ROLES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-pill border-[1.5px] border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-black transition-colors hover:border-black [letter-spacing:var(--tv-track-tight)]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="text-gray-400 font-medium">Viewing as</span>
        {current.label}
        <ChevronDown size={15} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[240px] overflow-hidden rounded-sm border border-gray-200 bg-white shadow-lg"
        >
          {ROLES.map((r) => {
            const active = r.id === role;
            return (
              <button
                key={r.id}
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/academy/${r.id}`);
                }}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                  active ? "bg-gray-50" : "hover:bg-gray-100",
                )}
              >
                <span className="mt-0.5 w-4 shrink-0 text-black">
                  {active && <Check size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
                    {r.label}
                  </span>
                  <span className="block text-[13px] text-gray-500">{r.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
