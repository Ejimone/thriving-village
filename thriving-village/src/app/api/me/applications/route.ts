import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getMyApplications } from "@/lib/data";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ applications: [] });

  const applications = await getMyApplications(session.jwt);
  return NextResponse.json({ applications });
}
