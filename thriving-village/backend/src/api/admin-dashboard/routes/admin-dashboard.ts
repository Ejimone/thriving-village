export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-dashboard/stats',
      handler: 'admin-dashboard.stats',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/admin-dashboard/activity',
      handler: 'admin-dashboard.activity',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/admin-dashboard/stream',
      handler: 'admin-dashboard.stream',
      config: { policies: [] },
    },
  ],
};
