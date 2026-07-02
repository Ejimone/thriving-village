/**
 * Minimal server-side Supabase Auth (GoTrue) client — same philosophy as
 * strapi.ts: plain fetch, no SDK. Only the three auth calls this app needs
 * (sign up, password sign-in), always from server actions; the browser never
 * talks to Supabase directly. The access tokens returned here are only ever
 * exchanged at the Django backend's /api/auth/supabase for our own JWT —
 * they're never stored or sent anywhere else.
 */

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export class SupabaseAuthError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "SupabaseAuthError";
    this.status = status;
    this.code = code;
  }
}

async function authFetch(
  path: string,
  body: Record<string, unknown>,
  query?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const qs = query ? `?${new URLSearchParams(query)}` : "";
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}${qs}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = String(data.msg || data.error_description || data.message || "Authentication failed");
    throw new SupabaseAuthError(message, res.status, String(data.error_code || data.error || ""));
  }
  return data;
}

export type SupabaseSignUpResult =
  | { accessToken: string } // confirmation disabled — session issued immediately
  | { accessToken: null }; // confirmation email sent (or email already registered — indistinguishable by design)

/** `metadata` is stored as Supabase user_metadata and read back by the
 *  Django exchange endpoint on first exchange (username, role) — it has to
 *  ride with the Supabase account because the confirmation-email round trip
 *  loses any local form state. */
export async function supabaseSignUp(
  email: string,
  password: string,
  metadata: Record<string, string>,
  emailRedirectTo: string,
): Promise<SupabaseSignUpResult> {
  const data = await authFetch("/signup", { email, password, data: metadata }, { redirect_to: emailRedirectTo });
  const accessToken = typeof data.access_token === "string" ? data.access_token : null;
  return { accessToken };
}

export async function supabasePasswordSignIn(email: string, password: string): Promise<string> {
  const data = await authFetch("/token", { email, password }, { grant_type: "password" });
  return String(data.access_token);
}
