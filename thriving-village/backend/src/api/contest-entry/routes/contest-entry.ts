import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::contest-entry.contest-entry', {
  only: ['find', 'findOne', 'update'],
});
