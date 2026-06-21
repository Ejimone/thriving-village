import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::job-application.job-application', {
  only: ['find', 'findOne', 'update'],
});
