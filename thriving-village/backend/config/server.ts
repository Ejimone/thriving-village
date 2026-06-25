import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  // Powers config/cron-tasks.ts (academy-weekly-rollout) — Strapi only loads
  // that file when cron is enabled here.
  cron: {
    enabled: true,
  },
});

export default config;
