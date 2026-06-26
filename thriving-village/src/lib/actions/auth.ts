"use server";

import { redirect } from "next/navigation";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import { setSession, clearSession } from "@/lib/session";
import type { Role } from "@/lib/constants";

export type AuthResult = { error?: string };

// Only ever redirect to a same-origin relative path — a `redirect` param is attacker-
// controllable (it round-trips through the URL), so anything else (protocol-relative
// `//evil.com`, absolute `https://evil.com`) is an open-redirect vector and gets ignored.
function safeRedirect(target: unknown): string | null {
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) return null;
  return target;
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
    return { error: err instanceof StrapiError ? err.message : "Something went wrong. Please try again." };
  }
  redirect(redirectTo || (role === "Admin" ? "/admin" : "/dashboard"));
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

export async function signOutAction() {
  await clearSession();
  redirect("/");
}
