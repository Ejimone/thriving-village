import utils from '@strapi/utils';

const { ValidationError } = utils.errors;
const ALLOWED_ROLES = ['talent', 'employer', 'student'];

// The built-in /api/auth/local/register always assigns the plugin's configured
// default role (Authenticated) and ignores any client-supplied role field —
// correct behavior (a client-supplied role id used to be a real CVE), but it
// means it can never satisfy this app's signup flow, which needs new accounts
// to land in our custom Talent/Employer role. This wraps the same user-creation
// path with a role resolved server-side from a constrained string enum.
export default {
  async register(ctx: any) {
    const { username, email, password, role } = ctx.request.body as any;

    if (!username || !email || !password || !role) {
      throw new ValidationError('username, email, password and role are required.');
    }
    if (!ALLOWED_ROLES.includes(role)) {
      throw new ValidationError(`role must be one of: ${ALLOWED_ROLES.join(', ')}`);
    }

    const existing = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { email: String(email).toLowerCase() },
    });
    if (existing) throw new ValidationError('Email is already taken.');

    const targetRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: role },
    });
    if (!targetRole) throw new ValidationError('Unknown role.');

    const userService = strapi.plugin('users-permissions').service('user');
    const jwtService = strapi.plugin('users-permissions').service('jwt');

    const user = await userService.add({
      username,
      email,
      password,
      provider: 'local',
      confirmed: true,
      blocked: false,
      role: targetRole.id,
    });

    const userSchema = strapi.getModel('plugin::users-permissions.user');
    const sanitizedUser = await strapi.contentAPI.sanitize.output(user, userSchema, { auth: ctx.state.auth });
    ctx.body = { jwt: jwtService.issue({ id: user.id }), user: sanitizedUser };
  },
};
