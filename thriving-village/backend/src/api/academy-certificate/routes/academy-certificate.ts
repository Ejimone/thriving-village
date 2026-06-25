import { factories } from '@strapi/strapi';

// No general core CRUD exposed via the Content API — certificates are issued
// automatically (see src/utils/academy-completion.ts), never created directly.
export default factories.createCoreRouter('api::academy-certificate.academy-certificate', { only: ['find', 'findOne'] });
