import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSavedJobSlugs } from "@/lib/data";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ slugs: [] });

  const slugs = await getSavedJobSlugs(session.jwt);
  return NextResponse.json({ slugs: [...slugs] });
}
