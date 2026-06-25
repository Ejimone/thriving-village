import { unwrapWebhookEvent } from '../../../utils/mux';

export default {
  async handle(ctx: any) {
    const rawBody = ctx.request.body?.[Symbol.for('unparsedBody')];
    if (!rawBody) return ctx.badRequest('Missing raw body.');

    let event;
    try {
      event = unwrapWebhookEvent(rawBody.toString(), ctx.request.headers);
    } catch {
      return ctx.unauthorized('Invalid Mux webhook signature.');
    }

    if (event.type === 'video.asset.ready') {
      const { upload_id, id: assetId, playback_ids } = event.data as any;
      const playbackId = playback_ids?.[0]?.id;
      await strapi.db.query('api::academy-material.academy-material').updateMany({
        where: { muxUploadId: upload_id },
        data: { muxAssetId: assetId, muxPlaybackId: playbackId },
      });
    }

    ctx.status = 200;
    ctx.body = { received: true };
  },
};
