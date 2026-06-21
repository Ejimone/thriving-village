"use server";

import { getSession } from "@/lib/session";
import { strapiFetch, StrapiError } from "@/lib/strapi";

export type ProgressResult = { error?: string; success?: boolean };

export async function markLessonCompleteAction(
  courseDbId: number,
  lessonKey: string,
): Promise<ProgressResult> {
  const session = await getSession();
  if (!session) return { error: "Sign in to track progress." };

  try {
    await strapiFetch("/api/progress", {
      method: "POST",
      token: session.jwt,
      body: { courseId: courseDbId, lessonKey },
    });
    // No cache tag to bust here — getCourseLessonProgress reads with noStore.
    return { success: true };
  } catch (err) {
    return { error: err instanceof StrapiError ? err.message : "Something went wrong." };
  }
}
