/**
 * Records an activity-log row and emits it on strapi.eventHub so the admin
 * dashboard's SSE stream (admin-dashboard.stream) can push it to connected
 * clients instantly, instead of waiting for the next poll/page load.
 */
export async function logActivity(
  strapi: any,
  entry: { who: string; what: string; kind: 'application' | 'entry' | 'enrollment' },
): Promise<void> {
  const occurredAt = new Date();
  await strapi.db.query('api::activity-log.activity-log').create({
    data: { ...entry, occurredAt },
  });
  await strapi.eventHub.emit('tv.activity', { who: entry.who, what: entry.what, when: occurredAt });
}
