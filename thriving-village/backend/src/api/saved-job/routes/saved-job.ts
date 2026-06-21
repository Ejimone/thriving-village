export default {
  routes: [
    {
      method: 'GET',
      path: '/saved-jobs',
      handler: 'saved-job.find',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/saved-jobs',
      handler: 'saved-job.save',
      config: { policies: [] },
    },
    {
      method: 'DELETE',
      path: '/saved-jobs/:jobSlug',
      handler: 'saved-job.unsave',
      config: { policies: [] },
    },
  ],
};
