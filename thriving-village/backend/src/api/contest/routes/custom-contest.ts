export default {
  routes: [
    {
      method: 'POST',
      path: '/contests/:slug/entries',
      handler: 'contest.enter',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/contests/:slug/leaderboard',
      handler: 'contest.leaderboard',
      config: { policies: [], auth: false },
    },
  ],
};
