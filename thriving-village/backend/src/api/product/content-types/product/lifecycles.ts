import utils from '@strapi/utils';

const { ValidationError } = utils.errors;

const CATEGORY_TYPES: Record<string, string[]> = {
  Apparel: ['Tee', 'Sweatshirt', 'Hoodie', 'Apron'],
  Accessories: ['Cap', 'Tote', 'Sticker'],
  Electronics: ['Laptop', 'Phone', 'Tablet', 'Monitor', 'Headphones', 'Keyboard', 'Charger'],
  Tools: ['Drill', 'Toolkit'],
  Furniture: ['Desk', 'Stool', 'Shelf'],
  Home: ['Mug', 'Notebook'],
};

const validate = (data: any) => {
  if (!data?.category || !data?.type) return;
  const allowed = CATEGORY_TYPES[data.category] || [];
  if (!allowed.includes(data.type)) {
    throw new ValidationError(`type "${data.type}" is not valid for category "${data.category}"`);
  }
};

export default {
  beforeCreate(event: any) {
    validate(event.params.data);
  },
  beforeUpdate(event: any) {
    validate(event.params.data);
  },
};
