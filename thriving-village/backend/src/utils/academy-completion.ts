import { logActivity } from './activity';

/**
 * Single choke point for "on course completion" (ACADEMY_BACKEND_SPEC.md §5.6) —
 * called from both the daily-submit path and the cohort-rollout path, since
 * either can be what pushes currentDay to daysTotal.
 */
export async function maybeCompleteEnrollment(
  strapi: any,
  enrollment: { id: number; currentDay: number; status: string; user: { id: number; name?: string; username: string } },
  cohort: { name: string; daysTotal: number },
  course: { title: string; certificate: boolean },
): Promise<void> {
  if (enrollment.currentDay < cohort.daysTotal) return;
  if (enrollment.status === 'Completed') return;

  await strapi.db.query('api::academy-enrollment.academy-enrollment').update({
    where: { id: enrollment.id },
    data: { status: 'Completed' },
  });

  if (!course.certificate) return;

  const existing = await strapi.db.query('api::academy-certificate.academy-certificate').findOne({
    where: { enrollment: enrollment.id },
  });
  if (existing) return;

  const studentName = enrollment.user.name || enrollment.user.username;
  await strapi.db.query('api::academy-certificate.academy-certificate').create({
    data: {
      enrollment: enrollment.id,
      issuedAt: new Date(),
      studentNameSnapshot: studentName,
      courseTitleSnapshot: course.title,
      cohortNameSnapshot: cohort.name,
    },
  });

  await logActivity(strapi, {
    who: studentName,
    what: `completed ${course.title} and earned a certificate`,
    kind: 'certificate-issued',
  });
}
