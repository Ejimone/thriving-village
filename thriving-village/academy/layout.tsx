import type { Metadata } from "next";
import { AcademyRoot } from "@/components/academy/AcademyRoot";

export const metadata: Metadata = {
  title: "Thriving Village Academy",
  description:
    "Cohort-based learning. Learn the craft one day at a time, with a facilitator and a community alongside you.",
};

export default function AcademyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AcademyRoot>{children}</AcademyRoot>;
}
