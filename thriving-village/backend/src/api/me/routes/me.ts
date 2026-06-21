export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/register',
      handler: 'auth.register',
      config: { policies: [], auth: false },
    },
    {
      method: 'GET',
      path: '/me',
      handler: 'me.whoami',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/me/applications',
      handler: 'me.applications',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/me/entries',
      handler: 'me.entries',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/me/courses',
      handler: 'me.courses',
      config: { policies: [] },
    },
  ],
};
