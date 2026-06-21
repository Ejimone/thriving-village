"use server";

import { redirect } from "next/navigation";
import { strapiFetch, StrapiError } from "@/lib/strapi";
import { setSession, clearSession } from "@/lib/session";
import type { Role } from "@/lib/constants";

export type AuthResult = { error?: string };

export async function signInAction(formData: FormData): Promise<AuthResult> {
  const identifier = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!identifier || !password) return { error: "Email and password are required." };

  try {
    const { jwt } = await strapiFetch<{ jwt: string }>("/api/auth/local", {
      method: "POST",
      body: { identifier, password },
    });
    const me = await strapiFetch<{ data: { role?: string } }>("/api/me", {
      token: jwt,
      noStore: true,
    });
    await setSession(jwt, (me.data.role as Role) || "Talent");
  } catch (err) {
    return { error: err instanceof StrapiError ? err.message : "Something went wrong. Please try again." };
  }
  redirect("/dashboard");
}

export async function signUpAction(formData: FormData): Promise<AuthResult> {
  const fullName = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "talent");

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
    await setSession(jwt, role === "employer" ? "Employer" : "Talent");
  } catch (err) {
    return { error: err instanceof StrapiError ? err.message : "Something went wrong. Please try again." };
  }
  redirect("/dashboard");
}

export async function signOutAction() {
  await clearSession();
  redirect("/");
}
