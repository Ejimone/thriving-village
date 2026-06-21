/** Cookie names shared between server code (src/lib/session.ts) and the edge
 *  middleware (middleware.ts) — kept in one place so they can't drift. */
export const JWT_COOKIE = "tv_jwt";
export const ROLE_COOKIE = "tv_role";

export type Role = "Talent" | "Employer" | "Admin";
