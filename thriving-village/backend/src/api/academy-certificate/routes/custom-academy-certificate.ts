export default {
  routes: [
    {
      method: 'GET',
      path: '/certificates/verify/:code',
      handler: 'academy-certificate.verify',
      config: { policies: [], auth: false },
    },
  ],
};
