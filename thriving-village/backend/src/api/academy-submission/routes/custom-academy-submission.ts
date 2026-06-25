export default {
  routes: [
    { method: 'GET', path: '/judge/queue', handler: 'academy-submission.judgeQueue', config: { policies: [] } },
    {
      method: 'POST',
      path: '/judge/submissions/:id/rate',
      handler: 'academy-submission.rate',
      config: { policies: [] },
    },
  ],
};
