"""Port of backend/src/utils/roster-request.ts. Shared by the cohort-scoped
create/list actions and the (Stage 11) admin-wide listing so the response
shape can't drift between the places that return one."""


def shape_roster_request(r) -> dict:
    return {
        "id": r.id,
        "status": r.status,
        "count": r.count,
        "note": r.note,
        "createdAt": r.created_at,
        "cohort": {"id": r.cohort.id, "name": r.cohort.name, "courseTitle": r.cohort.course.title} if r.cohort_id else None,
        "facilitator": {"id": r.facilitator.id, "name": r.facilitator.name or r.facilitator.username} if r.facilitator_id else None,
    }
