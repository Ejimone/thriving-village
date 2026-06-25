const facilitatorScoped = { policies: ['global::is-cohort-facilitator'] };

export default {
  routes: [
    { method: 'GET', path: '/facilitator/cohorts', handler: 'academy-cohort.myCohorts', config: { policies: [] } },
    { method: 'GET', path: '/cohorts/:id/roster', handler: 'academy-cohort.roster', config: facilitatorScoped },
    {
      method: 'GET',
      path: '/cohorts/:id/students/:uid',
      handler: 'academy-cohort.studentProfile',
      config: facilitatorScoped,
    },
    { method: 'GET', path: '/cohorts/:id/top-rated', handler: 'academy-cohort.topRated', config: facilitatorScoped },
    {
      method: 'POST',
      path: '/cohorts/:id/students/:uid/shortlist',
      handler: 'academy-cohort.shortlistToggle',
      config: facilitatorScoped,
    },
    {
      method: 'POST',
      path: '/cohorts/:id/students/:uid/remove',
      handler: 'academy-cohort.removeStudent',
      config: facilitatorScoped,
    },
    {
      method: 'POST',
      path: '/cohorts/:id/students/:uid/restore',
      handler: 'academy-cohort.restoreStudent',
      config: facilitatorScoped,
    },
    {
      method: 'POST',
      path: '/cohorts/:id/students/remove-bulk',
      handler: 'academy-cohort.removeBulk',
      config: facilitatorScoped,
    },
    {
      method: 'POST',
      path: '/cohorts/:id/students/:uid/transfer',
      handler: 'academy-cohort.transferStudent',
      config: facilitatorScoped,
    },
    {
      method: 'POST',
      path: '/cohorts/:id/students/transfer-bulk',
      handler: 'academy-cohort.transferBulk',
      config: facilitatorScoped,
    },
    { method: 'GET', path: '/cohorts/:id/threshold', handler: 'academy-cohort.getThreshold', config: facilitatorScoped },
    { method: 'PUT', path: '/cohorts/:id/threshold', handler: 'academy-cohort.putThreshold', config: facilitatorScoped },
    {
      method: 'POST',
      path: '/cohorts/:id/rollout-next-week',
      handler: 'academy-cohort.rolloutNextWeek',
      config: facilitatorScoped,
    },
    {
      method: 'GET',
      path: '/cohorts/:id/early-access-requests',
      handler: 'academy-cohort.earlyAccessRequests',
      config: facilitatorScoped,
    },
    { method: 'GET', path: '/cohorts/:id/sessions', handler: 'academy-cohort.sessionsFind', config: { policies: [] } },
    {
      method: 'POST',
      path: '/cohorts/:id/sessions',
      handler: 'academy-cohort.sessionsCreate',
      config: facilitatorScoped,
    },
    { method: 'POST', path: '/cohorts/:id/teams/match', handler: 'academy-cohort.teamsMatch', config: facilitatorScoped },
    { method: 'POST', path: '/cohorts/:id/teams', handler: 'academy-cohort.teamsCreate', config: facilitatorScoped },
    { method: 'DELETE', path: '/cohorts/:id/teams', handler: 'academy-cohort.teamsClear', config: facilitatorScoped },
    { method: 'GET', path: '/cohorts/:id/teams', handler: 'academy-cohort.teamsGet', config: facilitatorScoped },
  ],
};
