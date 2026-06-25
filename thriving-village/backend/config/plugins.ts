import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  upload: {
    config: {
      provider: 'cloudinary',
      providerOptions: {
        cloud_name: env('CLOUDINARY_CLOUD_NAME'),
        api_key: env('CLOUDINARY_API_KEY'),
        api_secret: env('CLOUDINARY_API_SECRET'),
      },
      actionOptions: {
        upload: {},
        delete: {},
      },
    },
  },
  'users-permissions': {
    config: {
      // dev/test environments hammer /auth/local repeatedly; keep the plugin's
      // default 5-requests-per-5-min IP rate limit for production but relax it locally.
      ratelimit: {
        enabled: env('NODE_ENV') === 'production',
      },
      // v5 defaults this to [] — the custom `name`/`whatsapp` fields on the user
      // model (src/extensions/users-permissions/content-types/user/schema.json)
      // won't be settable via POST /auth/local/register without this.
      register: {
        allowedFields: ['name', 'whatsapp'],
      },
    },
  },
  graphql: {
    // Disabled by default: the GraphQL plugin generates resolvers straight off
    // each content-type's service layer, bypassing the REST controllers' custom
    // logic entirely — confirmed by testing that `{ jobs { title } }` leaks
    // draft-status jobs to anonymous callers, since the draft filter lives only
    // in api::job.job's REST find/findOne overrides (see job/controllers/job.ts).
    // Flip to true only after adding equivalent guards as GraphQL resolver
    // overrides (or extra-resolvers) for Job/Contest/Course's custom logic.
    enabled: false,
    config: {
      endpoint: '/graphql',
      defaultLimit: 25,
      maxLimit: 100,
      apolloServer: {
        tracing: false,
      },
    },
  },
});

export default config;
