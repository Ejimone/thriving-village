import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::academy-enrollment.academy-enrollment', {
  // Enrollments are admin/facilitator-assigned (no self-serve create), and
  // are normally only soft-removed via the custom progression actions, never
  // updated/deleted directly. `delete` is the exception: admin-only, guarded
  // (see the controller) to data-hygiene cleanup of empty/corrupted rows.
  only: ['find', 'findOne', 'create', 'update', 'delete'],
});
