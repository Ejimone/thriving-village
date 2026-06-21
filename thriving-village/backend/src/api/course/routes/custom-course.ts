export default {
  routes: [
    {
      method: 'POST',
      path: '/courses/:slug/enroll',
      handler: 'course.enroll',
      config: { policies: [] },
    },
  ],
};
