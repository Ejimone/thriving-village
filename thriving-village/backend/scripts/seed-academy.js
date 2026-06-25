const { createStrapi, compileStrapi } = require('@strapi/strapi');

// Kept separate from scripts/seed.js (main-site seed) since the Academy seed
// set is large on its own — this script only touches academy-* content-types
// plus the student/facilitator/judge/admin test users.
async function main() {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  const userService = app.plugin('users-permissions').service('user');
  const roleByType = async (type) => app.db.query('plugin::users-permissions.role').findOne({ where: { type } });

  const adminRole = await roleByType('admin');
  const studentRole = await roleByType('student');
  const facilitatorRole = await roleByType('facilitator');
  const judgeRole = await roleByType('judge');

  const ensureUser = async (email, role, extra = {}) => {
    const existing = await app.db.query('plugin::users-permissions.user').findOne({ where: { email } });
    if (existing) return existing;
    return userService.add({
      username: email,
      email,
      password: 'TestPass123!',
      provider: 'local',
      confirmed: true,
      blocked: false,
      role: role.id,
      ...extra,
    });
  };

  const admin = await ensureUser('academy-admin-seed@example.com', adminRole, { name: 'Academy Admin' });
  const facilitator = await ensureUser('facilitator-seed@example.com', facilitatorRole, {
    name: 'Chidi Okafor',
    whatsapp: '+234 701 555 0001',
  });
  const judge = await ensureUser('judge-seed@example.com', judgeRole, { name: 'Anon Judge' });

  // --- catalogue: 5 categories, ~21 courses ---
  const CATEGORIES = [
    { slug: 'ai-data', name: 'AI & Data', blurb: 'Turn raw data into decisions, and learn the craft behind modern AI.' },
    { slug: 'creative-design', name: 'Creative & Design', blurb: 'From the first mark to a full visual system — the craft of making things look right.' },
    { slug: 'marketing', name: 'Marketing', blurb: 'Reach people, hold their attention, and turn it into growth.' },
    { slug: 'development', name: 'Development', blurb: 'Build for the web, for mobile, and everything that holds it together.' },
    { slug: 'entrepreneurship', name: 'Entrepreneurship', blurb: 'Start something, run it well, and put your name to your work.' },
  ];

  const COURSES = [
    ['ai-data', 'Data Analytics', 4],
    ['ai-data', 'Data Science', 6],
    ['creative-design', 'Graphic Design', 4],
    ['creative-design', 'UI/UX Design', 5],
    ['creative-design', 'Video Editing', 3],
    ['creative-design', 'Motion Graphics & Animation', 5],
    ['creative-design', 'Photography', 3],
    ['creative-design', 'Brand & Visual Identity Design', 4],
    ['marketing', 'Digital Marketing', 4],
    ['marketing', 'Content Marketing & Writing', 3],
    ['marketing', 'Social Media Marketing', 3],
    ['development', 'Frontend Development', 3],
    ['development', 'Backend Development', 4],
    ['development', 'Mobile Development', 4],
    ['development', 'Full-stack Development', 6],
    ['development', 'E-commerce Development', 4],
    ['development', 'Cybersecurity', 5],
    ['entrepreneurship', 'Starting a Business', 3],
    ['entrepreneurship', 'Product Management', 4],
    ['entrepreneurship', 'Personal Branding & Freelancing', 3],
    ['entrepreneurship', 'Sales', 3],
  ];

  const categoryByRecord = {};
  for (const c of CATEGORIES) {
    categoryByRecord[c.slug] =
      (await app.db.query('api::academy-category.academy-category').findOne({ where: { slug: c.slug } })) ||
      (await app.entityService.create('api::academy-category.academy-category', {
        data: { name: c.name, slug: c.slug, blurb: c.blurb },
      }));
  }

  const courseByTitle = {};
  for (const [catSlug, title, months] of COURSES) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    courseByTitle[title] =
      (await app.db.query('api::academy-course.academy-course').findOne({ where: { slug } })) ||
      (await app.entityService.create('api::academy-course.academy-course', {
        data: {
          title,
          slug,
          category: categoryByRecord[catSlug].id,
          months,
          certificate: true,
          weeksTotal: months * 4,
          daysTotal: months * 4 * 7,
        },
      }));
  }

  // --- the one detailed cohort: Frontend Development Cohort 7 ---
  const frontendCourse = courseByTitle['Frontend Development'];
  const cohort =
    (await app.db.query('api::academy-cohort.academy-cohort').findOne({ where: { name: 'Cohort 7', course: frontendCourse.id } })) ||
    (await app.entityService.create('api::academy-cohort.academy-cohort', {
      data: {
        name: 'Cohort 7',
        course: frontendCourse.id,
        facilitator: facilitator.id,
        weeksTotal: 13,
        daysTotal: 90,
        startDate: new Date(Date.now() - 11 * 86400000),
        status: 'Running',
        releasedWeek: 2,
        minCompletion: 60,
        checkWeeks: [4, 8],
      },
    }));

  // --- 14-student roster, seeded with progress matching the frontend mock ---
  const ROSTER = [
    ['Ada Okonkwo', 11, 'on-track'],
    ['Emeka Balogun', 13, 'on-track'],
    ['Zainab Yusuf', 12, 'on-track'],
    ['Tunde Adeyemi', 9, 'behind'],
    ['Amara Eze', 14, 'on-track'],
    ['Chidi Nwosu', 11, 'on-track'],
    ['Ngozi Obi', 7, 'at-risk'],
    ['Bola Adesanya', 12, 'on-track'],
    ['Ifeanyi Eze', 10, 'behind'],
    ['Funke Akin', 13, 'on-track'],
    ['Sade Bello', 11, 'on-track'],
    ['Kelechi Umeh', 8, 'behind'],
    ['Maryam Sani', 14, 'on-track'],
    ['Obi Anozie', 12, 'on-track'],
  ];

  const studentUsers = [];
  for (const [name, dayReached] of ROSTER) {
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@academy-seed.example.com`;
    const user = await ensureUser(email, studentRole, {
      name,
      whatsapp: `+234 70${Math.floor(Math.random() * 9)} ${String(Math.floor(Math.random() * 900) + 100)} ${String(Math.floor(Math.random() * 9000) + 1000)}`,
    });
    studentUsers.push({ user, name, dayReached });

    const existingEnrollment = await app.db.query('api::academy-enrollment.academy-enrollment').findOne({
      where: { user: user.id, cohort: cohort.id },
    });
    if (!existingEnrollment) {
      await app.entityService.create('api::academy-enrollment.academy-enrollment', {
        data: {
          user: user.id,
          cohort: cohort.id,
          status: 'In progress',
          currentDay: dayReached,
          submittedDays: Array.from({ length: Math.max(0, dayReached - 1) }, (_, i) => i + 1),
          earlyAccessRequested: false,
          earlyWeeks: [],
          removed: false,
          shortlisted: false,
        },
      });
    }
  }

  // --- live sessions ---
  const SESSIONS = [
    { title: 'Week 2 group call', type: 'Live call', day: 'Tomorrow', time: '5:00 PM WAT', host: 'Chidi Okafor', link: 'https://meet.google.com/abc-defg-hij' },
    { title: 'CSS layout workshop', type: 'Workshop', day: 'Thursday', time: '6:00 PM WAT', host: 'Chidi Okafor', link: 'https://zoom.us/j/123456789' },
    { title: 'Office hours', type: 'Live call', day: 'Saturday', time: '11:00 AM WAT', host: 'Chidi Okafor' },
    { title: 'Week 3 kickoff', type: 'Live call', day: 'Next Monday', time: '5:00 PM WAT', host: 'Chidi Okafor', link: 'https://meet.google.com/xyz-week3-kick' },
  ];
  for (const s of SESSIONS) {
    const existing = await app.db.query('api::academy-live-session.academy-live-session').findOne({
      where: { cohort: cohort.id, title: s.title },
    });
    if (!existing) {
      await app.entityService.create('api::academy-live-session.academy-live-session', { data: { ...s, cohort: cohort.id } });
    }
  }

  // --- one seeded material example (Day 12 of Frontend Development) ---
  const existingMaterial = await app.db.query('api::academy-material.academy-material').findOne({
    where: { course: frontendCourse.id, day: 12 },
  });
  if (!existingMaterial) {
    await app.entityService.create('api::academy-material.academy-material', {
      data: {
        course: frontendCourse.id,
        day: 12,
        text:
          "HTML gives a page its meaning, not just its look. Use elements for what they are — a <nav> for navigation, a <button> for actions, headings in order. Screen readers and search engines rely on that structure.\n\nFor today's task, mark up a small profile card using only semantic elements. No <div> soup. Keep it clean and readable.",
        externalVideoUrl: 'https://www.youtube.com/watch?v=kUMe1FH4CHE',
        task: 'Build task — structure with HTML',
        taskDetail: 'Mark up a small profile card using only semantic elements, then paste a link to your work.',
        docs: [
          { label: 'MDN — HTML semantics', href: '#' },
          { label: 'WAI-ARIA basics', href: '#' },
        ],
      },
    });
  }

  // --- a handful of submissions + judgments so the judge queue / profiles aren't empty ---
  const ANON_HANDLES = ['Entry A12', 'Entry B07', 'Entry C31', 'Entry D18', 'Entry E44'];
  let handleIdx = 0;
  for (const { user, name, dayReached } of studentUsers.slice(0, 5)) {
    const enrollment = await app.db.query('api::academy-enrollment.academy-enrollment').findOne({
      where: { user: user.id, cohort: cohort.id },
    });
    const day = Math.max(1, dayReached - 1);
    const existingSubmission = await app.db.query('api::academy-submission.academy-submission').findOne({
      where: { enrollment: enrollment.id, day },
    });
    if (existingSubmission) continue;

    const submission = await app.entityService.create('api::academy-submission.academy-submission', {
      data: {
        enrollment: enrollment.id,
        day,
        week: Math.ceil(day / 7),
        task: `Day ${day} task`,
        courseTitle: frontendCourse.title,
        // Deliberately NOT derived from the student's username/email — a real
        // work URL is whatever the student pastes, but seed data shouldn't
        // smuggle identity into the one field judges are meant to see.
        url: `https://example.com/work/${ANON_HANDLES[handleIdx].toLowerCase().replace(/\s+/g, '-')}`,
        note: 'Mobile-first build, kept the breakpoints minimal.',
        submittedAt: new Date(),
        rated: handleIdx >= 3, // leave the first 3 unrated so the judge queue has pending entries
        anonHandle: ANON_HANDLES[handleIdx++],
      },
    });

    if (submission.rated) {
      await app.entityService.create('api::academy-judgment.academy-judgment', {
        data: {
          submission: submission.id,
          judge: judge.id,
          brief: 4,
          craft: 4,
          originality: 3,
          average: 3.7,
          feedback: 'Solid grasp of the brief. Tighten the spacing next time.',
        },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        admin: { id: admin.id, email: admin.email },
        facilitator: { id: facilitator.id, email: facilitator.email },
        judge: { id: judge.id, email: judge.email },
        cohort: { id: cohort.id, name: cohort.name },
        studentCount: studentUsers.length,
        categories: Object.keys(categoryByRecord).length,
        courses: Object.keys(courseByTitle).length,
      },
      null,
      2,
    ),
  );

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
