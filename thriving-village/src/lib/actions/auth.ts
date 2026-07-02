"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import { setSession, clearSession } from "@/lib/session";
import {
  supabaseConfigured,
  supabaseSignUp,
  supabasePasswordSignIn,
  SupabaseAuthError,
} from "@/lib/supabase-auth";
import type { Role } from "@/lib/constants";

export type AuthResult = { error?: string; message?: string };

type MeUser = { id: number; username?: string; email?: string; role?: string };

// Only ever redirect to a same-origin relative path — a `redirect` param is attacker-
// controllable (it round-trips through the URL), so anything else (protocol-relative
// `//evil.com`, absolute `https://evil.com`) is an open-redirect vector and gets ignored.
function safeRedirect(target: unknown): string | null {
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) return null;
  return target;
}

function homeFor(role: Role): string {
  return role === "Admin" ? "/admin" : "/dashboard";
}

/** Exchanges a Supabase access token for our backend's JWT (find-or-create by
 *  email) and opens the cookie session — shared by sign-in fallback, sign-up
 *  (when confirmation is disabled) and the /auth/callback confirmation page. */
async function openSessionFromSupabaseToken(
  accessToken: string,
  extras: { username?: string; role?: string } = {},
): Promise<Role> {
  const { jwt, user } = await strapiFetch<{ jwt: string; user: MeUser }>("/api/auth/supabase", {
    method: "POST",
    body: { access_token: accessToken, ...extras },
    noStore: true,
  });
  const role = (user.role as Role) || "Talent";
  await setSession(jwt, role, user.username || "");
  return role;
}

export async function signInAction(formData: FormData): Promise<AuthResult> {
  const identifier = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!identifier || !password) return { error: "Email and password are required." };
  const redirectTo = safeRedirect(formData.get("redirect"));

  let role: Role;
  try {
    const { jwt } = await strapiFetch<{ jwt: string }>("/api/auth/local", {
      method: "POST",
      body: { identifier, password },
    });
    const me = await strapiFetch<{ data: { username?: string; role?: string } }>("/api/me", {
      token: jwt,
      noStore: true,
    });
    role = (me.data.role as Role) || "Talent";
    await setSession(jwt, role, me.data.username || "");
  } catch (err) {
    // Accounts created through Supabase signup have no local password — fall
    // back to Supabase's password grant and exchange the token. Only on 400
    // (bad credentials); other statuses (blocked, backend down) surface as-is.
    if (err instanceof StrapiError && err.status === 400 && supabaseConfigured && identifier.includes("@")) {
      try {
        const accessToken = await supabasePasswordSignIn(identifier, password);
        role = await openSessionFromSupabaseToken(accessToken);
      } catch (supabaseErr) {
        if (supabaseErr instanceof SupabaseAuthError && supabaseErr.code === "email_not_confirmed") {
          return { error: "Please confirm your email first — check your inbox for the confirmation link." };
        }
        return { error: err.message };
      }
    } else {
      return { error: err instanceof StrapiError ? err.message : "Something went wrong. Please try again." };
    }
  }
  redirect(redirectTo || homeFor(role));
}

export async function signUpAction(formData: FormData): Promise<AuthResult> {
  const fullName = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "talent");
  const redirectTo = safeRedirect(formData.get("redirect"));

  if (!fullName || !email || !password) {
    return { error: "Name, email and password are required." };
  }
  if (role !== "talent" && role !== "employer") {
    return { error: "Invalid role." };
  }

  // Supabase-backed signup (email confirmation) when configured; classic
  // instant registration against the backend otherwise — same form either way.
  if (supabaseConfigured) {
    try {
      const origin = (await headers()).get("origin") || process.env.SITE_URL || "http://localhost:3000";
      const callback = `${origin}/auth/callback${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`;
      const result = await supabaseSignUp(email, password, { username: fullName, role }, callback);

      if (result.accessToken) {
        // "Confirm email" is off in this Supabase project — session immediately.
        await openSessionFromSupabaseToken(result.accessToken, { username: fullName, role });
      } else {
        // Same message whether this email is new or already registered —
        // Supabase deliberately doesn't distinguish, to prevent enumeration.
        return {
          message: `We've sent a confirmation link to ${email}. Click it to activate your account.`,
        };
      }
    } catch (err) {
      if (err instanceof SupabaseAuthError) {
        if (err.code === "user_already_exists" || err.status === 422) {
          return { error: "This email is already registered. Try signing in instead." };
        }
        return { error: err.message };
      }
      return { error: err instanceof StrapiError ? err.message : "Something went wrong. Please try again." };
    }
    redirect(redirectTo || "/dashboard");
  }

  try {
    const { jwt } = await strapiFetch<{ jwt: string }>("/api/auth/register", {
      method: "POST",
      body: { username: fullName, email, password, role },
    });
    await setSession(jwt, role === "employer" ? "Employer" : "Talent", fullName);
  } catch (err) {
    return { error: err instanceof StrapiError ? err.message : "Something went wrong. Please try again." };
  }
  redirect(redirectTo || "/dashboard");
}

/** Called by /auth/callback after the user clicks the Supabase confirmation
 *  link — the fragment tokens are parsed client-side and handed here to be
 *  exchanged for a backend JWT + cookie session. Returns the destination so
 *  the client can router.replace() it (a thrown redirect() would be swallowed
 *  by the client-side error boundary when invoked outside a form action). */
export async function supabaseCallbackAction(
  accessToken: string,
  redirectTo?: string | null,
): Promise<AuthResult & { dest?: string }> {
  if (!accessToken) return { error: "Missing access token." };
  try {
    const role = await openSessionFromSupabaseToken(accessToken);
    return { dest: safeRedirect(redirectTo) || homeFor(role) };
  } catch (err) {
    return { error: err instanceof StrapiError ? err.message : "Could not complete sign-in. Please try again." };
  }
}

export async function forgotPasswordAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Email is required." };

  try {
    await strapiFetch<{ ok: boolean }>("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
      noStore: true,
    });
  } catch (err) {
    if (err instanceof StrapiError && err.status === 429) {
      return { error: "Too many reset requests. Please wait a while and try again." };
    }
    return { error: "Something went wrong. Please try again." };
  }
  // Deliberately identical whether or not the account exists.
  return { message: "If an account exists for that email, we've sent a link to reset your password." };
}

export async function resetPasswordAction(formData: FormData): Promise<AuthResult> {
  const code = String(formData.get("code") || "").trim();
  const password = String(formData.get("password") || "");
  const passwordConfirmation = String(formData.get("passwordConfirmation") || "");

  if (!code) return { error: "Reset code is missing — use the link from your email." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (password !== passwordConfirmation) return { error: "Passwords do not match." };

  let role: Role;
  try {
    const { jwt, user } = await strapiFetch<{ jwt: string; user: MeUser }>("/api/auth/reset-password", {
      method: "POST",
      body: { code, password, passwordConfirmation },
      noStore: true,
    });
    role = (user.role as Role) || "Talent";
    await setSession(jwt, role, user.username || "");
  } catch (err) {
    if (err instanceof StrapiError && err.status === 400) {
      return { error: "This reset link is invalid or has expired. Request a new one below." };
    }
    return { error: err instanceof StrapiError ? err.message : "Something went wrong. Please try again." };
  }
  redirect(homeFor(role));
}

export async function signOutAction() {
  await clearSession();
  redirect("/");
}
