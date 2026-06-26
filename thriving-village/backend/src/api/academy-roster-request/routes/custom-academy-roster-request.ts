export default {
  routes: [
    {
      method: 'PUT',
      path: '/roster-requests/:id',
      handler: 'academy-roster-request.updateStatus',
      config: { policies: [] },
    },
  ],
};
