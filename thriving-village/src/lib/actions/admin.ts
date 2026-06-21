"use server";

import { revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { strapiFetch, StrapiError } from "@/lib/strapi";

export type AdminResult = { error?: string; success?: boolean };

function linesToArray(value: FormDataEntryValue | null): string[] {
  return String(value || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Nested components (contest.prizes, course.modules) are edited as raw JSON — see field hints in the form. */
function parseJsonField(value: FormDataEntryValue | null, fieldLabel: string): unknown[] {
  const raw = String(value || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed;
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON (an array). Check the syntax.`);
  }
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "Admin") throw new Error("Admin access required.");
  return session;
}

async function writeEntity(
  resource: string,
  documentId: string | null,
  data: Record<string, unknown>,
  token: string,
) {
  if (documentId) {
    await strapiFetch(`/api/${resource}/${documentId}`, { method: "PUT", token, body: { data } });
  } else {
    await strapiFetch(`/api/${resource}`, { method: "POST", token, body: { data } });
  }
}

async function deleteEntity(resource: string, documentId: string, token: string) {
  await strapiFetch(`/api/${resource}/${documentId}`, { method: "DELETE", token });
}

/* ---------------- Jobs ---------------- */

export async function saveJobAction(documentId: string | null, formData: FormData): Promise<AdminResult> {
  try {
    const session = await requireAdmin();
    const data = {
      title: String(formData.get("title") || ""),
      org: String(formData.get("org") || ""),
      orgKind: String(formData.get("orgKind") || ""),
      field: String(formData.get("field") || ""),
      location: String(formData.get("location") || ""),
      locationType: String(formData.get("locationType") || ""),
      type: String(formData.get("type") || ""),
      level: String(formData.get("level") || ""),
      pay: String(formData.get("pay") || ""),
      summary: String(formData.get("summary") || ""),
      responsibilities: linesToArray(formData.get("responsibilities")),
      requirements: linesToArray(formData.get("requirements")),
      status: String(formData.get("status") || "published"),
    };
    await writeEntity("jobs", documentId, data, session.jwt);
    revalidateTag("jobs", { expire: 0 });
    return { success: true };
  } catch (err) {
    return { error: err instanceof StrapiError || err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function deleteJobAction(documentId: string): Promise<AdminResult> {
  try {
    const session = await requireAdmin();
    await deleteEntity("jobs", documentId, session.jwt);
    revalidateTag("jobs", { expire: 0 });
    return { success: true };
  } catch (err) {
    return { error: err instanceof StrapiError || err instanceof Error ? err.message : "Something went wrong." };
  }
}

/* ---------------- Contests ---------------- */

export async function saveContestAction(documentId: string | null, formData: FormData): Promise<AdminResult> {
  try {
    const session = await requireAdmin();
    const data = {
      title: String(formData.get("title") || ""),
      field: String(formData.get("field") || ""),
      brief: String(formData.get("brief") || ""),
      rules: linesToArray(formData.get("rules")),
      deadline: String(formData.get("deadline") || ""),
      status: String(formData.get("status") || "live"),
      prizes: parseJsonField(formData.get("prizes"), "Prizes"),
    };
    await writeEntity("contests", documentId, data, session.jwt);
    revalidateTag("contests", { expire: 0 });
    return { success: true };
  } catch (err) {
    return { error: err instanceof StrapiError || err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function deleteContestAction(documentId: string): Promise<AdminResult> {
  try {
    const session = await requireAdmin();
    await deleteEntity("contests", documentId, session.jwt);
    revalidateTag("contests", { expire: 0 });
    return { success: true };
  } catch (err) {
    return { error: err instanceof StrapiError || err instanceof Error ? err.message : "Something went wrong." };
  }
}

/* ---------------- Courses ---------------- */

export async function saveCourseAction(documentId: string | null, formData: FormData): Promise<AdminResult> {
  try {
    const session = await requireAdmin();
    const data = {
      title: String(formData.get("title") || ""),
      field: String(formData.get("field") || ""),
      level: String(formData.get("level") || ""),
      kind: String(formData.get("kind") || ""),
      delivery: String(formData.get("delivery") || ""),
      location: String(formData.get("location") || "") || null,
      instructor: String(formData.get("instructor") || ""),
      instructorRole: String(formData.get("instructorRole") || ""),
      price: Number(formData.get("price") || 0),
      weeks: Number(formData.get("weeks") || 0),
      blurb: String(formData.get("blurb") || ""),
      outcomes: linesToArray(formData.get("outcomes")),
      modules: parseJsonField(formData.get("modules"), "Curriculum"),
    };
    await writeEntity("courses", documentId, data, session.jwt);
    revalidateTag("courses", { expire: 0 });
    return { success: true };
  } catch (err) {
    return { error: err instanceof StrapiError || err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function deleteCourseAction(documentId: string): Promise<AdminResult> {
  try {
    const session = await requireAdmin();
    await deleteEntity("courses", documentId, session.jwt);
    revalidateTag("courses", { expire: 0 });
    return { success: true };
  } catch (err) {
    return { error: err instanceof StrapiError || err instanceof Error ? err.message : "Something went wrong." };
  }
}
