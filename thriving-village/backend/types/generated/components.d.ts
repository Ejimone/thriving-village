import type { Schema, Struct } from '@strapi/strapi';

export interface ContestPrize extends Struct.ComponentSchema {
  collectionName: 'components_contest_prizes';
  info: {
    displayName: 'Prize';
    icon: 'money';
  };
  attributes: {
    amount: Schema.Attribute.Decimal & Schema.Attribute.Required;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    place: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
  };
}

export interface CourseLesson extends Struct.ComponentSchema {
  collectionName: 'components_course_lessons';
  info: {
    displayName: 'Lesson';
    icon: 'play';
  };
  attributes: {
    duration: Schema.Attribute.String & Schema.Attribute.Required;
    free: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    key: Schema.Attribute.String & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface CourseModule extends Struct.ComponentSchema {
  collectionName: 'components_course_modules';
  info: {
    displayName: 'Module';
    icon: 'stack';
  };
  attributes: {
    lessons: Schema.Attribute.Component<'course.lesson', true>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'contest.prize': ContestPrize;
      'course.lesson': CourseLesson;
      'course.module': CourseModule;
    }
  }
}
