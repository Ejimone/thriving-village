export default {
  routes: [
    {
      method: 'POST',
      path: '/progress',
      handler: 'lesson-progress.mark',
      config: { policies: [] },
    },
  ],
};
