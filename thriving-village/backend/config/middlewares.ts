import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::compression',
    config: {
      threshold: 1024, // don't bother compressing tiny responses
      br: true,
      gzip: true,
    },
  },
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      // Mux webhook signature verification needs the exact raw bytes — this
      // adds the raw buffer alongside the normally-parsed body for every
      // route (only the mux-webhook handler reads it), it doesn't change
      // parsing behavior anywhere else.
      includeUnparsed: true,
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
