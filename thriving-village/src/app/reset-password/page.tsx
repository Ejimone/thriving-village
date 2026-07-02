import { redirect } from "next/navigation";

// The backend's reset emails link to {FRONTEND_URL}/reset-password?code=... —
// a stable, frontend-agnostic path (the academy app uses the same convention).
// The actual page lives under the auth layout; forward the code along.
export const dynamic = "force-dynamic";

export default async function ResetPasswordRedirect({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  redirect(code ? `/auth/reset-password?code=${encodeURIComponent(code)}` : "/auth/reset-password");
}
