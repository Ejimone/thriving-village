import { factories } from '@strapi/strapi';
import { resolveSlugParam } from '../../../utils/scoped-find';

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  async findOne(ctx) {
    await resolveSlugParam(strapi, 'api::product.product', ctx);
    return super.findOne(ctx);
  },
}));
