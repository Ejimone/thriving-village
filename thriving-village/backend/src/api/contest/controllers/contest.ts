import { factories } from '@strapi/strapi';
import { resolveSlugParam } from '../../../utils/scoped-find';

const prizePool = (prizes: any[] = []) => prizes.reduce((sum, p) => sum + Number(p.amount || 0), 0);
const topPrize = (prizes: any[] = []) => prizes.reduce((max, p) => Math.max(max, Number(p.amount || 0)), 0);
const winnerCount = (prizes: any[] = []) => prizes.length;

const daysLeft = (deadline: string | Date) =>
  Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);

const withComputed = (entity: any) => {
  if (!entity) return entity;
  if (Array.isArray(entity)) return entity.map(withComputed);
  return {
    ...entity,
    daysLeft: daysLeft(entity.deadline),
    prizePool: prizePool(entity.prizes),
    topPrize: topPrize(entity.prizes),
    winnerCount: winnerCount(entity.prizes),
  };
};

export default factories.createCoreController('api::contest.contest', ({ strapi }) => ({
  async find(ctx) {
    ctx.query = { ...ctx.query, populate: ctx.query.populate || ['prizes'] };
    const { data, meta } = await super.find(ctx);
    return { data: withComputed(data), meta };
  },

  async findOne(ctx) {
    await resolveSlugParam(strapi, 'api::contest.contest', ctx);
    ctx.query = { ...ctx.query, populate: ctx.query.populate || ['prizes'] };
    const response = await super.findOne(ctx);
    return { data: withComputed(response?.data), meta: response?.meta };
  },

  async enter(ctx) {
    const { slug } = ctx.params;
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be signed in to enter.');

    const contest = await strapi.db.query('api::contest.contest').findOne({ where: { slug } });
    if (!contest) return ctx.notFound('Contest not found.');
    if (contest.status !== 'live' || new Date(contest.deadline) < new Date()) {
      return ctx.badRequest('This contest is no longer accepting entries.');
    }

    const existing = await strapi.db.query('api::contest-entry.contest-entry').findOne({
      where: { contest: contest.id, user: user.id },
    });
    if (existing) return ctx.conflict('You have already entered this contest.');

    const body = (ctx.request.body as any)?.data
      ? JSON.parse((ctx.request.body as any).data)
      : ctx.request.body;
    const { name, whatsapp, description } = body || {};
    if (!name || !whatsapp || !description) {
      return ctx.badRequest('name, whatsapp and description are required.');
    }

    const files = (ctx.request as any).files;
    const work = files?.work;

    const entry = await strapi.entityService.create('api::contest-entry.contest-entry', {
      data: {
        contest: contest.id,
        user: user.id,
        name,
        whatsapp,
        description,
        status: 'Submitted',
        ...(work ? { work } : {}),
      },
      files: work ? { work } : undefined,
    } as any);

    await strapi.db.query('api::contest.contest').update({
      where: { id: contest.id },
      data: { entries: (contest.entries || 0) + 1 },
    });

    await strapi.db.query('api::activity-log.activity-log').create({
      data: {
        who: name,
        what: `entered ${contest.title}`,
        kind: 'entry',
        occurredAt: new Date(),
      },
    });

    ctx.body = { data: entry };
  },

  async leaderboard(ctx) {
    const { slug } = ctx.params;
    const contest = await strapi.db.query('api::contest.contest').findOne({
      where: { slug },
      populate: ['prizes'],
    });
    if (!contest) return ctx.notFound('Contest not found.');

    const entries = await strapi.db.query('api::contest-entry.contest-entry').findMany({
      where: { contest: contest.id, rank: { $notNull: true } },
      orderBy: { rank: 'asc' },
    });

    const prizes: any[] = contest.prizes || [];
    const board = entries.map((e: any) => {
      const prize = prizes.find((p) => p.place === e.rank);
      return {
        name: e.name,
        rank: e.rank,
        note: e.description,
        status: e.status,
        prize: prize ? { label: prize.label, amount: prize.amount } : null,
      };
    });

    ctx.body = { data: board };
  },
}));
