/**
 * Minimal Strapi REST client. No SWR/React Query/Axios — every call here is
 * a server-side fetch, either cached with Next's tag-based revalidation (for
 * public catalog reads) or `no-store` (for per-user reads). The query
 * serializer builds Strapi's bracket syntax (`filters[x][$eq]=y`,
 * `pagination[page]=1`, `fields[0]=title`) from a plain params object so
 * every call site states explicitly which fields/relations/page it wants —
 * never `populate=*`, never an unbounded list.
 */

const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";

export class StrapiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "StrapiError";
    this.status = status;
  }
}

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
  };
  if (noStore) {
    init.cache = "no-store";
  } else if (next) {
    init.next = next;
  }

  const res = await fetch(url, init);

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
