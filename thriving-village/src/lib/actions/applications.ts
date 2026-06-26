"use server";

import { revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { strapiFetch, StrapiError } from "@/lib/strapi";

export type SubmitResult = { error?: string; success?: boolean };

async function postApplyLike(
  path: string,
  fields: Record<string, string>,
  fileField: string | null,
  file: File | null,
  token: string,
) {
  if (fileField && file && file.size > 0) {
    const body = new FormData();
    body.append("data", JSON.stringify(fields));
    body.append(fileField, file, file.name);
    return strapiFetch(path, { method: "POST", token, body });
  }
  return strapiFetch(path, { method: "POST", token, body: fields });
}

export async function applyToJobAction(jobSlug: string, formData: FormData): Promise<SubmitResult> {
  const session = await getSession();
  if (!session) return { error: "Sign in to apply." };

  const name = String(formData.get("name") || "");
  const whatsapp = String(formData.get("whatsapp") || "");
  const message = String(formData.get("message") || "");
  const portfolioUrl = String(formData.get("portfolioUrl") || "");
  const videoUrl = String(formData.get("videoUrl") || "");
  const file = formData.get("file") as File | null;

  if (!videoUrl) return { error: "A short intro video URL (e.g. a Loom link) is required." };

  try {
    await postApplyLike(
      `/api/jobs/${jobSlug}/apply`,
      { name, whatsapp, message, portfolioUrl, videoUrl },
      "cv",
      file,
      session.jwt,
    );
    revalidateTag(`job:${jobSlug}`, { expire: 0 });
    return { success: true };
  } catch (err) {
    return { error: err instanceof StrapiError ? err.message : "Something went wrong." };
  }
}

export async function enterContestAction(contestSlug: string, formData: FormData): Promise<SubmitResult> {
  const session = await getSession();
  if (!session) return { error: "Sign in to enter." };

  const name = String(formData.get("name") || "");
  const whatsapp = String(formData.get("whatsapp") || "");
  const description = String(formData.get("description") || "");
  const file = formData.get("file") as File | null;

  try {
    await postApplyLike(
      `/api/contests/${contestSlug}/entries`,
      { name, whatsapp, description },
      "work",
      file,
      session.jwt,
    );
    revalidateTag(`contest:${contestSlug}`, { expire: 0 });
    return { success: true };
  } catch (err) {
    return { error: err instanceof StrapiError ? err.message : "Something went wrong." };
  }
}

export async function enrollInCourseAction(courseSlug: string, formData: FormData): Promise<SubmitResult> {
  const session = await getSession();
  if (!session) return { error: "Sign in to enroll." };

  const name = String(formData.get("name") || "");
  const whatsapp = String(formData.get("whatsapp") || "");
  const message = String(formData.get("message") || "");

  try {
    await strapiFetch(`/api/courses/${courseSlug}/enroll`, {
      method: "POST",
      token: session.jwt,
      body: { name, whatsapp, message },
    });
    revalidateTag(`course:${courseSlug}`, { expire: 0 });
    return { success: true };
  } catch (err) {
    return { error: err instanceof StrapiError ? err.message : "Something went wrong." };
  }
}
