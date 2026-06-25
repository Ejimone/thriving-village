import { factories } from '@strapi/strapi';

// No core CRUD exposed — submissions are only ever created via
// academy-enrollment.submitTask, never directly.
export default factories.createCoreRouter('api::academy-submission.academy-submission', { only: [] });
