export default {
  routes: [
    {
      method: 'POST',
      path: '/enrollments/:id/submissions',
      handler: 'academy-enrollment.submitTask',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/enrollments/:id/submissions',
      handler: 'academy-enrollment.listSubmissions',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/enrollments/:id/early-access/request',
      handler: 'academy-enrollment.requestEarlyAccess',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/enrollments/:id/early-access/grant',
      handler: 'academy-enrollment.grantEarlyAccess',
      config: { policies: ['global::is-enrollment-cohort-facilitator'] },
    },
    {
      method: 'GET',
      path: '/enrollments/:id/team',
      handler: 'academy-enrollment.team',
      config: { policies: [] },
    },
  ],
};
