/** Plain slugify — no external dep, matches what Strapi's admin UI would generate for a uid field. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'item';
}

/**
 * The admin Content Manager UI generates `uid` fields client-side before submit, so they're
 * never auto-generated when an entity is created directly via the REST API (e.g. from a
 * frontend Server Action) — without this, `POST /api/jobs` etc. fail with "slug must be defined".
 */
export async function uniqueSlug(strapi: any, uid: string, base: string): Promise<string> {
  let candidate = base;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await strapi.db.query(uid).findOne({ where: { slug: candidate } });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}
