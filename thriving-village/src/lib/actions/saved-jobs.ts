"use server";

import { getSession } from "@/lib/session";
import { strapiFetch, StrapiError } from "@/lib/strapi";

export async function toggleSavedJobAction(
  jobSlug: string,
  save: boolean,
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sign in to save jobs." };

  try {
    if (save) {
      await strapiFetch("/api/saved-jobs", {
        method: "POST",
        token: session.jwt,
        body: { jobSlug },
      });
    } else {
      await strapiFetch(`/api/saved-jobs/${jobSlug}`, {
        method: "DELETE",
        token: session.jwt,
      });
    }
    return {};
  } catch (err) {
    return { error: err instanceof StrapiError ? err.message : "Something went wrong." };
  }
}
