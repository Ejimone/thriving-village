export default {
  routes: [
    {
      method: 'POST',
      path: '/jobs/:slug/apply',
      handler: 'job.apply',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/jobs/:slug/applicants',
      handler: 'job.applicants',
      config: {
        policies: [],
      },
    },
    {
      // Deliberately not nested under /jobs/:something — that shape collides with the
      // core router's GET /jobs/:id (findOne) route.
      method: 'GET',
      path: '/job-stream',
      handler: 'job.stream',
      config: {
        policies: [],
      },
    },
  ],
};
