import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";

/**
 * Proxies Strapi's SSE stream so the browser's EventSource only ever talks to
 * this same-origin route — avoids CORS and the fact that EventSource can't
 * send a custom Authorization header. The httpOnly session cookie (invisible
 * to client JS) is read here, server-side, and forwarded as a Bearer token.
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "Admin") {
    return new Response("Unauthorized", { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${STRAPI_URL}/api/admin-dashboard/stream`, {
      headers: { Authorization: `Bearer ${session.jwt}` },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[activity-stream] fetch threw:", err);
    return new Response("Activity stream unavailable", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "<unreadable>");
    console.error(
      `[activity-stream] upstream not ok — status=${upstream.status} statusText=${upstream.statusText} body=${text.slice(0, 500)}`,
    );
    return new Response("Activity stream unavailable", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
