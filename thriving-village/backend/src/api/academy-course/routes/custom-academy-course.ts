export default {
  routes: [
    {
      method: 'GET',
      path: '/courses/:courseId/curriculum',
      handler: 'academy-course.curriculum',
      config: { policies: [] },
    },
  ],
};
