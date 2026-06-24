"use client";

import { usePathname } from "next/navigation";
import { CohortProvider } from "@/components/academy/CohortProvider";
import { AcademyShell } from "@/components/academy/AcademyShell";

/**
 * Root of the Academy property. The sign-in screen (`/academy`) renders
 * standalone — no authenticated chrome. Every other Academy route is wrapped
 * in the shared progression state and the Academy shell.
 */
export function AcademyRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSignIn = pathname === "/academy";

  if (isSignIn) return <>{children}</>;

  return (
    <CohortProvider>
      <AcademyShell>{children}</AcademyShell>
    </CohortProvider>
  );
}
