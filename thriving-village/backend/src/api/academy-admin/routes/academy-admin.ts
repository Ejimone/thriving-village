export default {
  routes: [
    { method: 'GET', path: '/admin/overview', handler: 'academy-admin.overview', config: { policies: [] } },
    { method: 'GET', path: '/admin/top-rated', handler: 'academy-admin.topRated', config: { policies: [] } },
    { method: 'GET', path: '/admin/activity', handler: 'academy-admin.activity', config: { policies: [] } },
    { method: 'GET', path: '/admin/users', handler: 'academy-admin.users', config: { policies: [] } },
  ],
};
