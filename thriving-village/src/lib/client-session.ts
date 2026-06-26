import { ROLE_COOKIE } from "./constants";

// `tv_role` is deliberately non-httpOnly (see src/lib/session.ts) so client components
// can read sign-in state directly without an extra round trip to the server.
export function isSignedInClientSide(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c.startsWith(`${ROLE_COOKIE}=`));
}
