export default {
  routes: [
    {
      method: 'POST',
      path: '/webhooks/mux',
      handler: 'mux-webhook.handle',
      config: { policies: [], auth: false },
    },
  ],
};
