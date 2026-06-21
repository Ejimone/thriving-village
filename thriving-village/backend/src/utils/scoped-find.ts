// Content-types here expose human-readable `slug` URLs (e.g. /api/jobs/frontend-developer),
// but Strapi v5's default findOne route resolves :id against documentId, not arbitrary
// UID fields, and silently returns an empty result for a slug that isn't a documentId.
// Rewrite ctx.params.id to the real documentId when it matches a slug; leave it alone
// otherwise so documentId-based calls (e.g. from the admin UI) keep working unchanged.
export async function resolveSlugParam(strapi: any, uid: string, ctx: any, slugField = 'slug') {
  const record = await strapi.db.query(uid).findOne({
    where: { [slugField]: ctx.params.id },
    select: ['documentId'],
  });
  if (record) ctx.params.id = record.documentId;
}

// Strapi's REST query validator rejects filters on relations that target
// plugin::users-permissions.user (e.g. `?filters[user][id]=1`) for security
// reasons, so "find my own records" can't go through super.find(ctx) with an
// injected filter. This bypasses that layer using the lower-level DB query
// engine, which has no such restriction, and reshapes the result into the
// same { data, meta: { pagination } } envelope the REST API normally returns.
export async function scopedFind(strapi: any, uid: string, ctx: any, where: Record<string, any>) {
  const pagination = (ctx.query.pagination as any) || {};
  const pageSize = Math.min(Number(pagination.pageSize) || 25, 100);
  const page = Math.max(Number(pagination.page) || 1, 1);
  const offset = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    strapi.db.query(uid).findMany({
      where,
      limit: pageSize,
      offset,
      orderBy: { createdAt: 'desc' },
      populate: ctx.query.populate,
    }),
    strapi.db.query(uid).count({ where }),
  ]);

  return {
    data,
    meta: {
      pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize) || 0, total },
    },
  };
}
