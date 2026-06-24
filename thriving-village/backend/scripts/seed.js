const { createStrapi, compileStrapi } = require('@strapi/strapi');

async function main() {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  const userService = app.plugin('users-permissions').service('user');
  const talentRole = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'talent' } });
  const adminRole = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'admin' } });

  // --- test users ---
  const ensureUser = async (email, role) => {
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
    });
  };

  const talentA = await ensureUser('talent-a@example.com', talentRole);
  const talentB = await ensureUser('talent-b@example.com', talentRole);
  const adminUser = await ensureUser('admin-seed@example.com', adminRole);

  // --- catalog content ---
  const job1 = await app.db.query('api::job.job').findOne({ where: { slug: 'frontend-developer' } }) ||
    await app.entityService.create('api::job.job', {
      data: {
        title: 'Frontend Developer',
        slug: 'frontend-developer',
        org: 'Thriving Village',
        orgKind: 'Sister business',
        field: 'Digital',
        location: 'Lagos',
        locationType: 'Hybrid',
        type: 'Full-time',
        level: 'Mid',
        pay: '₦450k–700k / mo',
        summary: 'Build and ship UI for the community platform.',
        responsibilities: ['Build UI components', 'Pair with design', 'Ship weekly'],
        requirements: ['2+ years React', 'Comfortable with TypeScript'],
        status: 'published',
      },
    });

  const job2 = await app.db.query('api::job.job').findOne({ where: { slug: 'welder-apprentice' } }) ||
    await app.entityService.create('api::job.job', {
      data: {
        title: 'Welder Apprentice',
        slug: 'welder-apprentice',
        org: 'Lagos Metal Works',
        orgKind: 'Partner',
        field: 'Technical',
        location: 'Lagos',
        locationType: 'Onsite',
        type: 'Full-time',
        level: 'Entry',
        pay: 'Per piece',
        summary: 'Learn structural welding on real client jobs.',
        responsibilities: ['Assist senior welders', 'Maintain tools'],
        requirements: ['Willingness to learn', 'Physically fit'],
        status: 'published',
      },
    });

  await app.entityService.create('api::job.job', {
    data: {
      title: '',
      slug: 'draft-job-test',
      org: 'Internal',
      orgKind: 'Sister business',
      field: 'Digital',
      location: 'Remote',
      locationType: 'Remote',
      type: 'Contract',
      level: 'Entry',
      pay: 'TBD',
      summary: 'Should not appear for Public.',
      responsibilities: ['n/a'],
      requirements: ['n/a'],
      status: 'draft',
    },
  }).catch(() => {});

  const contest1 = await app.db.query('api::contest.contest').findOne({ where: { slug: 'logo-design-challenge' } }) ||
    await app.entityService.create('api::contest.contest', {
      data: {
        title: 'Logo Design Challenge',
        slug: 'logo-design-challenge',
        field: 'Creative',
        brief: 'Design a logo for a new sister business.',
        rules: ['One entry per person', 'Original work only'],
        deadline: new Date(Date.now() + 5 * 86400000),
        status: 'live',
        entries: 0,
        prizes: [
          { place: 1, label: '1st place', amount: 150000 },
          { place: 2, label: 'Runner-up', amount: 75000 },
          { place: 3, label: "People's choice", amount: 30000 },
        ],
        seed: 'logo-contest',
      },
    });

  const course1 = await app.db.query('api::course.course').findOne({ where: { slug: 'intro-to-frontend' } }) ||
    await app.entityService.create('api::course.course', {
      data: {
        title: 'Intro to Frontend',
        slug: 'intro-to-frontend',
        field: 'Digital',
        level: 'Entry',
        kind: 'Course',
        delivery: 'Online',
        instructor: 'Ada Okonkwo',
        instructorRole: 'Senior Engineer',
        price: 45000,
        weeks: 6,
        blurb: 'Get started building real interfaces.',
        outcomes: ['Build a responsive page', 'Understand component design'],
        modules: [
          {
            title: 'HTML & CSS Basics',
            lessons: [
              { key: 'l1', title: 'Structuring a page', duration: '12 min', free: true },
              { key: 'l2', title: 'Styling with CSS', duration: '18 min', free: false },
            ],
          },
          {
            title: 'JavaScript Fundamentals',
            lessons: [
              { key: 'l3', title: 'Variables & functions', duration: '20 min', free: false },
              { key: 'l4', title: 'DOM manipulation', duration: '25 min', free: false },
            ],
          },
        ],
        seed: 'frontend-course',
      },
    });

  await app.entityService.create('api::product.product', {
    data: {
      name: 'Thriving Village Tee',
      slug: 'thriving-village-tee',
      category: 'Apparel',
      type: 'Tee',
      price: 12000,
      blurb: 'Soft cotton tee, community print.',
      details: ['100% cotton', 'Unisex fit'],
      sizes: ['S', 'M', 'L', 'XL'],
      maker: 'TV Maker Network',
      condition: 'New',
      shopifyUrl: 'https://shop.example.com/products/tv-tee',
    },
  }).catch(() => {});

  await app.entityService.create('api::brand.brand', {
    data: {
      name: 'Lagos Metal Works',
      kind: 'Partner',
      industry: 'Technical',
      tagline: 'Steel work, done right, every time.',
      url: 'https://example.com/lmw',
      featured: true,
      seed: 'lmw-brand',
    },
  }).catch(() => {});

  await app.entityService.create('api::testimonial.testimonial', {
    data: {
      quote: 'Thriving Village got me my first paid design gig.',
      name: 'Chiamaka U.',
      role: 'Graphic Designer',
    },
  }).catch(() => {});

  console.log(JSON.stringify({
    talentA: { id: talentA.id, email: talentA.email },
    talentB: { id: talentB.id, email: talentB.email },
    adminUser: { id: adminUser.id, email: adminUser.email },
    job1: { id: job1.id, slug: job1.slug },
    job2: { id: job2.id, slug: job2.slug },
    contest1: { id: contest1.id, slug: contest1.slug },
    course1: { id: course1.id, slug: course1.slug },
  }, null, 2));

  await app.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
