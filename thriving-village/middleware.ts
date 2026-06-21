import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { JWT_COOKIE, ROLE_COOKIE } from "@/lib/constants";

/**
 * Route-level redirect only — the real security boundary is the Strapi API
 * itself (role-scoped permissions, already enforced server-side). This just
 * gives a clean UX redirect without a network round-trip per request.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const jwt = request.cookies.get(JWT_COOKIE)?.value;
  const role = request.cookies.get(ROLE_COOKIE)?.value;

  if (pathname.startsWith("/dashboard") && !jwt) {
    const url = new URL("/auth/signin", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && role !== "Admin") {
    return NextResponse.redirect(new URL(jwt ? "/dashboard" : "/auth/signin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
