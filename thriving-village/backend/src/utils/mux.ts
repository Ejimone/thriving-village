import Mux from '@mux/mux-node';

let client: Mux | null = null;
function getMux(): Mux {
  if (!client) {
    client = new Mux({
      tokenId: process.env.MUX_TOKEN_ID!,
      tokenSecret: process.env.MUX_TOKEN_SECRET!,
    });
  }
  return client;
}

/**
 * Lesson video must be gated to enrolled/authenticated users, so every asset
 * is created with a SIGNED playback policy — never 'public'. The raw
 * playback URL is never handed to a client; only signPlaybackToken() output is.
 */
export async function createDirectUpload() {
  const mux = getMux();
  return mux.video.uploads.create({
    cors_origin: process.env.ACADEMY_FRONTEND_ORIGIN || '*',
    new_asset_settings: { playback_policy: ['signed'] },
  });
}

export async function signPlaybackToken(playbackId: string, expirationSeconds = 60 * 60 * 4): Promise<string> {
  const mux = getMux();
  return mux.jwt.signPlaybackId(playbackId, {
    type: 'video',
    expiration: `${expirationSeconds}s`,
    keyId: process.env.MUX_SIGNING_KEY_ID!,
    keySecret: process.env.MUX_SIGNING_KEY_PRIVATE!,
  });
}

/** Throws if the payload wasn't sent by Mux; returns the verified, parsed event otherwise. */
export function unwrapWebhookEvent(rawBody: string, headers: Record<string, string | string[] | undefined>) {
  const mux = getMux();
  return mux.webhooks.unwrap(rawBody, headers as any, process.env.MUX_WEBHOOK_SECRET);
}
