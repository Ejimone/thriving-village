// Shared by academy-cohort (create/list, cohort-scoped), academy-admin
// (list-all), and academy-roster-request (status update) controllers so the
// response shape can't drift between the three places that return one.
export function shapeRosterRequest(r: any) {
  return {
    id: r.id,
    status: r.status,
    count: r.count,
    note: r.note,
    createdAt: r.createdAt,
    cohort: r.cohort ? { id: r.cohort.id, name: r.cohort.name, courseTitle: r.cohort.course?.title } : null,
    facilitator: r.facilitator ? { id: r.facilitator.id, name: r.facilitator.name || r.facilitator.username } : null,
  };
}
