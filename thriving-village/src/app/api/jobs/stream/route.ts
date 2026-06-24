export const runtime = "nodejs";

const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";

/**
 * Proxies Strapi's public job-creation SSE stream so the browser's EventSource talks
 * same-origin (avoids CORS). Unlike the admin activity stream, this one is public — no
 * session check — since it only ever carries fields already visible via GET /jobs.
 */
export async function GET() {
  const upstream = await fetch(`${STRAPI_URL}/api/job-stream`, { cache: "no-store" });

  if (!upstream.ok || !upstream.body) {
    return new Response("Job stream unavailable", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
