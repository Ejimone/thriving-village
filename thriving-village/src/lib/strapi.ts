/**
 * Minimal Strapi REST client. No SWR/React Query/Axios — every call here is
 * a server-side fetch, either cached with Next's tag-based revalidation (for
 * public catalog reads) or `no-store` (for per-user reads). The query
 * serializer builds Strapi's bracket syntax (`filters[x][$eq]=y`,
 * `pagination[page]=1`, `fields[0]=title`) from a plain params object so
 * every call site states explicitly which fields/relations/page it wants —
 * never `populate=*`, never an unbounded list.
 */

import { BulkheadRejectedError, CircuitBreaker, CircuitOpenError } from "./circuit-breaker";

// A trailing slash here (e.g. from copy-pasting a URL straight out of a
// browser address bar) combined with every call site's leading "/api/..."
// path produces a double slash, which 404s — and since every data.ts
// function catches fetch errors and falls back to an empty result, that
// 404 has no visible error, it just looks like "there's no data". Stripping
// it here means a trailing slash can never reproduce that silently again.
export const STRAPI_URL = (process.env.STRAPI_URL || "http://localhost:1337").replace(/\/+$/, "");
const STRAPI_TIMEOUT_MS = 5000;

export class StrapiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "StrapiError";
    this.status = status;
  }
}

/**
 * Guards every call to the backend so a slow/down Strapi can't pile up
 * in-flight Next.js requests across every page render and server action that
 * depends on it (every one of those call sites already catches `StrapiError`
 * and falls back to an empty/null result, so a tripped breaker degrades the
 * same way a normal request error would).
 */
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  cooldownMs: 10_000,
  halfOpenSuccesses: 2,
  maxConcurrent: 10,
});

function appendQueryParam(params: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => appendQueryParam(params, `${key}[${i}]`, v));
  } else if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) =>
      appendQueryParam(params, `${key}[${k}]`, v),
    );
  } else {
    params.append(key, String(value));
  }
}

export function toQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => appendQueryParam(params, key, value));
  return params.toString();
}

type FetchOptions = {
  query?: Record<string, unknown>;
  token?: string | null;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown> | FormData;
  /** Per-tag cache invalidation for public, cacheable reads. */
  next?: { revalidate?: number | false; tags?: string[] };
  /** Per-user or write reads/writes that must never be cached. */
  noStore?: boolean;
};

export async function strapiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { query, token, method = "GET", body, next, noStore } = options;
  const qs = query ? toQueryString(query) : "";
  const url = `${STRAPI_URL}${path}${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body && !isFormData) headers["Content-Type"] = "application/json";

  const init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
    method,
    headers,
    body: body ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
    signal: AbortSignal.timeout(STRAPI_TIMEOUT_MS),
  };
  if (noStore) {
    init.cache = "no-store";
  } else if (next) {
    init.next = next;
  }

  let res: Response;
  try {
    res = await breaker.exec(() => fetch(url, init));
  } catch (err) {
    if (err instanceof CircuitOpenError || err instanceof BulkheadRejectedError) {
      throw new StrapiError("Service temporarily unavailable", 503);
    }
    throw err;
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const errJson = await res.json();
      message = errJson?.error?.message || message;
    } catch {
      // non-JSON error body — fall back to statusText
    }
    throw new StrapiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type StrapiPagination = { page: number; pageSize: number; pageCount: number; total: number };
export type StrapiListResponse<T> = { data: T[]; meta: { pagination: StrapiPagination } };
export type StrapiSingleResponse<T> = { data: T };
