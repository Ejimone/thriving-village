import { cookies } from "next/headers";
import { JWT_COOKIE, ROLE_COOKIE, type Role } from "./constants";

export type Session = { jwt: string; role: Role };

const MAX_AGE = 60 * 60 * 24 * 30; // 30 days — matches the Strapi JWT's own expiry window

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const jwt = store.get(JWT_COOKIE)?.value;
  const role = store.get(ROLE_COOKIE)?.value as Role | undefined;
  if (!jwt || !role) return null;
  return { jwt, role };
}

export async function setSession(jwt: string, role: Role) {
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  store.set(JWT_COOKIE, jwt, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: MAX_AGE });
  store.set(ROLE_COOKIE, role, { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(JWT_COOKIE);
  store.delete(ROLE_COOKIE);
}
