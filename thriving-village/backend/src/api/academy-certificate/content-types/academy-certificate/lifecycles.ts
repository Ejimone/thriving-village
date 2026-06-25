import crypto from 'crypto';

// Generates a short, URL-safe, public verification code at create time. Not
// derived from any human-readable field (no `uid`-eligible title to target),
// so it's set explicitly rather than relying on Strapi's `uid` auto-generation.
export default {
  beforeCreate(event: any) {
    const { data } = event.params;
    if (!data.verificationCode) {
      data.verificationCode = crypto.randomBytes(6).toString('base64url');
    }
  },
};
