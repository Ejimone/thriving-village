// weeksTotal/daysTotal are real columns (per spec) derived from `months`, not
// computed at read time — Strapi has no virtual/computed column type.
export default {
  beforeCreate(event: any) {
    const { data } = event.params;
    if (data.months && !data.weeksTotal) data.weeksTotal = data.months * 4;
    if (data.weeksTotal && !data.daysTotal) data.daysTotal = data.weeksTotal * 7;
  },
  beforeUpdate(event: any) {
    const { data } = event.params;
    if (data.months && !data.weeksTotal) data.weeksTotal = data.months * 4;
    if (data.weeksTotal && !data.daysTotal) data.daysTotal = data.weeksTotal * 7;
  },
};
