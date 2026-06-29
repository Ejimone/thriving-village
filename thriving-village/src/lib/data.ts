/* ============================================================
   Data-access layer for the Thriving Village frontend.
   Every export here is backed by the real Strapi backend
   (see ../../documentation.md). Pages import the same names as
   before — only the array constants became async fetch functions.
   All money is in Naira.
   ============================================================ */

import { strapiFetch, STRAPI_URL, type StrapiListResponse, type StrapiSingleResponse } from "./strapi";

// Re-exported so pages/cards can pull data + formatting from one module.
export { naira } from "./utils";

export type Field = "Digital" | "Technical" | "Craft" | "Creative";
export type LocationType = "Remote" | "Onsite" | "Hybrid";
export type ExperienceLevel = "Entry" | "Mid" | "Senior";

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
};

const emptyPage = <T>(page = 1, pageSize = 12): Paginated<T> => ({
  items: [],
  page,
  pageSize,
  pageCount: 0,
  total: 0,
});

/* ============================================================
   JOBS
   ============================================================ */

export type Job = {
  id: string; // = Strapi slug
  /** Strapi's documentId — needed only for admin write routes (PUT/DELETE use documentId, not slug). */
  documentId: string;
  title: string;
  org: string;
  orgKind: string;
  field: Field;
  location: string;
  locationType: LocationType;
  type: "Full-time" | "Part-time" | "Contract";
  level: ExperienceLevel;
  pay: string;
  postedAgo: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  /** Only populated by admin (full) fetches — never relevant to public read paths. */
  status?: "draft" | "published" | "closed";
};

/**
 * `responsibilities`/`requirements`/`rules` are plain `json` fields meant to hold a
 * string array, but content written outside our admin UI (e.g. an LLM creating rows
 * straight in the database) sometimes uses Strapi's rich-text "blocks" shape instead
 * (`{ type: "paragraph", children: [{ type: "text", text }] }`). Rendering one of
 * those directly as a list item crashes the page (objects aren't valid React
 * children), so normalize either shape down to plain strings here.
 */
function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && Array.isArray((item as { children?: unknown }).children)) {
        return (item as { children: { text?: string }[] }).children
          .map((c) => c?.text ?? "")
          .join("");
      }
      return "";
    })
    .filter(Boolean);
}

function mapJob(raw: Record<string, unknown>): Job {
  return {
    id: String(raw.slug),
    documentId: String(raw.documentId),
    title: String(raw.title),
    org: String(raw.org),
    orgKind: String(raw.orgKind),
    field: raw.field as Field,
    location: String(raw.location),
    locationType: raw.locationType as LocationType,
    type: raw.type as Job["type"],
    level: raw.level as ExperienceLevel,
    pay: String(raw.pay),
    postedAgo: String(raw.postedAgo ?? ""),
    summary: String(raw.summary ?? ""),
    status: raw.status as Job["status"] | undefined,
    responsibilities: normalizeStringList(raw.responsibilities),
    requirements: normalizeStringList(raw.requirements),
  };
}

export async function getJobs(
  params: {
    field?: Field;
    locationType?: LocationType;
    level?: ExperienceLevel;
    query?: string;
    page?: number;
    pageSize?: number;
    /** Admin-only: skip the restricted field list (admin forms need to edit every field). */
    full?: boolean;
    /** Admin-only: needed so the backend's draft-hiding filter doesn't apply to the caller's own admin list. */
    token?: string;
  } = {},
): Promise<Paginated<Job>> {
  const { field, locationType, level, query, page = 1, pageSize = 12, full, token } = params;

  try {
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/jobs", {
      query: { field, locationType, level, search: query, page, page_size: pageSize },
      next: full ? undefined : { revalidate: 60, tags: ["jobs"] },
      noStore: full,
      token,
    });
    return {
      items: res.data.map(mapJob),
      page: res.meta.pagination.page,
      pageSize: res.meta.pagination.pageSize,
      pageCount: res.meta.pagination.pageCount,
      total: res.meta.pagination.total,
    };
  } catch {
    return emptyPage(page, pageSize);
  }
}

/** `token` is admin-only: without it the request is anonymous, so a draft job 404s even for an admin caller. */
export async function getJob(id: string, token?: string): Promise<Job | null> {
  try {
    const res = await strapiFetch<StrapiSingleResponse<Record<string, unknown>>>(`/api/jobs/${id}`, {
      token,
      next: token ? undefined : { revalidate: 60, tags: ["jobs", `job:${id}`] },
      noStore: !!token,
    });
    return res.data ? mapJob(res.data) : null;
  } catch {
    return null;
  }
}

/* ============================================================
   CONTESTS
   ============================================================ */

export type ContestPrize = { place: number; label: string; amount: number };

export type Contest = {
  id: string; // = slug
  /** Strapi's documentId — needed only for admin write routes (PUT/DELETE use documentId, not slug). */
  documentId: string;
  title: string;
  field: Field;
  prizes: ContestPrize[];
  entries: number;
  daysLeft: number;
  /** Raw ISO deadline — used only to prefill the admin edit form. */
  deadline: string;
  status: "live" | "past";
  brief: string;
  rules: string[];
  seed: string;
  /** Computed server-side — see documentation.md. */
  prizePoolTotal: number;
  topPrizeAmount: number;
  winners: number;
};

/**
 * `status` is only valid as "live" or "past", but content written outside our admin
 * UI can land an unrecognized value (e.g. an LLM writing "published" straight into
 * the database). Rather than silently dropping those contests from both the live and
 * past lists, fall back to deriving status from the deadline so they still show up
 * somewhere sensible.
 */
function normalizeContestStatus(rawStatus: unknown, deadline: unknown): Contest["status"] {
  if (rawStatus === "live" || rawStatus === "past") return rawStatus;
  const deadlineMs = new Date(String(deadline)).getTime();
  return Number.isFinite(deadlineMs) && deadlineMs >= Date.now() ? "live" : "past";
}

function mapContest(raw: Record<string, unknown>): Contest {
  const prizes = ((raw.prizes as Record<string, unknown>[]) ?? []).map((p) => ({
    place: Number(p.place),
    label: String(p.label),
    amount: Number(p.amount),
  }));
  return {
    id: String(raw.slug),
    documentId: String(raw.documentId),
    title: String(raw.title),
    field: raw.field as Field,
    prizes,
    entries: Number(raw.entries ?? 0),
    daysLeft: Number(raw.daysLeft ?? 0),
    deadline: String(raw.deadline ?? ""),
    status: normalizeContestStatus(raw.status, raw.deadline),
    brief: String(raw.brief ?? ""),
    rules: normalizeStringList(raw.rules),
    seed: String(raw.seed ?? raw.slug),
    prizePoolTotal: Number(raw.prizePool ?? 0),
    topPrizeAmount: Number(raw.topPrize ?? 0),
    winners: Number(raw.winnerCount ?? prizes.length),
  };
}

/** Total prize pool across all tiers — sourced from the backend's computed field. */
export const prizePool = (c: Contest): number => c.prizePoolTotal;
/** The top (largest) prize amount. */
export const topPrize = (c: Contest): number => c.topPrizeAmount;
/** Number of winners a campaign rewards. */
export const winnerCount = (c: Contest): number => c.winners;

export async function getContests(
  params: { status?: "live" | "past"; page?: number; pageSize?: number } = {},
): Promise<Paginated<Contest>> {
  const { status, page = 1, pageSize = 12 } = params;

  try {
    // Status is filtered client-side (after normalizeContestStatus) rather than via a
    // `?status=` exact-match filter — an exact-match filter would silently drop any
    // contest whose stored status isn't literally "live"/"past" (see normalizeContestStatus).
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/contests", {
      query: { ordering: "deadline", page_size: 100 },
      next: { revalidate: 60, tags: ["contests"] },
    });
    const all = res.data.map(mapContest);
    const filtered = status ? all.filter((c) => c.status === status) : all;
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      page,
      pageSize,
      pageCount: Math.ceil(filtered.length / pageSize) || 0,
      total: filtered.length,
    };
  } catch {
    return emptyPage(page, pageSize);
  }
}

export async function getContest(id: string): Promise<Contest | null> {
  try {
    const res = await strapiFetch<StrapiSingleResponse<Record<string, unknown>>>(`/api/contests/${id}`, {
      next: { revalidate: 60, tags: ["contests", `contest:${id}`] },
    });
    return res.data ? mapContest(res.data) : null;
  } catch {
    return null;
  }
}

export type LeaderboardEntry = {
  name: string;
  rank: number;
  note: string;
  status: string;
  prize: { label: string; amount: number } | null;
};

export async function getLeaderboard(id: string): Promise<LeaderboardEntry[]> {
  try {
    const res = await strapiFetch<{ data: LeaderboardEntry[] }>(`/api/contests/${id}/leaderboard`, {
      next: { revalidate: 60, tags: [`contest:${id}`] },
    });
    return res.data ?? [];
  } catch {
    return [];
  }
}

/* ============================================================
   COURSES
   ============================================================ */

export type Lesson = { id: string; title: string; duration: string; free?: boolean };
export type CourseModule = { title: string; lessons: Lesson[] };
export type CourseDelivery = "Online" | "Onsite" | "Hybrid";
export type CourseKind = "Course" | "Certification";

export type Course = {
  id: string; // = slug
  /** Strapi's numeric row id — needed only to scope the /api/lesson-progresses lookup. */
  dbId: number;
  /** Strapi's documentId — needed only for admin write routes (PUT/DELETE use documentId, not slug). */
  documentId: string;
  title: string;
  field: Field;
  level: ExperienceLevel;
  kind: CourseKind;
  delivery: CourseDelivery;
  location?: string;
  instructor: string;
  instructorRole: string;
  price: number;
  weeks: number;
  lessonCount: number;
  seed: string;
  blurb: string;
  outcomes: string[];
  modules: CourseModule[];
};

function mapCourse(raw: Record<string, unknown>): Course {
  const modules = ((raw.modules as Record<string, unknown>[]) ?? []).map((m) => ({
    title: String(m.title),
    lessons: ((m.lessons as Record<string, unknown>[]) ?? []).map((l) => ({
      id: String(l.key),
      title: String(l.title),
      duration: String(l.duration),
      free: Boolean(l.free),
    })),
  }));
  return {
    id: String(raw.slug),
    dbId: Number(raw.id),
    documentId: String(raw.documentId),
    title: String(raw.title),
    field: raw.field as Field,
    level: raw.level as ExperienceLevel,
    kind: raw.kind as CourseKind,
    delivery: raw.delivery as CourseDelivery,
    location: (raw.location as string) || undefined,
    instructor: String(raw.instructor),
    instructorRole: String(raw.instructorRole),
    price: Number(raw.price),
    weeks: Number(raw.weeks),
    lessonCount: Number(raw.lessonCount ?? modules.reduce((n, m) => n + m.lessons.length, 0)),
    seed: String(raw.seed ?? raw.slug),
    blurb: String(raw.blurb ?? ""),
    outcomes: (raw.outcomes as string[]) ?? [],
    modules,
  };
}

export type PriceBand = "all" | "under-50k" | "50k-250k" | "250k-1m" | "1m-plus";

export const PRICE_BANDS: { label: string; value: PriceBand }[] = [
  { label: "Any price", value: "all" },
  { label: "Under ₦50k", value: "under-50k" },
  { label: "₦50k – ₦250k", value: "50k-250k" },
  { label: "₦250k – ₦1M", value: "250k-1m" },
  { label: "₦1M and up", value: "1m-plus" },
];

export const inPriceBand = (price: number, band: PriceBand): boolean => {
  switch (band) {
    case "under-50k":
      return price < 50000;
    case "50k-250k":
      return price >= 50000 && price < 250000;
    case "250k-1m":
      return price >= 250000 && price < 1000000;
    case "1m-plus":
      return price >= 1000000;
    default:
      return true;
  }
};

/** Translates a price band into `priceMin`/`priceMax` query bounds (or none for "all"). */
function priceBandQuery(band?: PriceBand): { priceMin?: number; priceMax?: number } {
  switch (band) {
    case "under-50k":
      return { priceMax: 50000 };
    case "50k-250k":
      return { priceMin: 50000, priceMax: 250000 };
    case "250k-1m":
      return { priceMin: 250000, priceMax: 1000000 };
    case "1m-plus":
      return { priceMin: 1000000 };
    default:
      return {};
  }
}

export async function getCourses(
  params: {
    field?: Field;
    delivery?: CourseDelivery;
    kind?: CourseKind;
    level?: ExperienceLevel;
    price?: PriceBand;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<Paginated<Course>> {
  const { field, delivery, kind, level, price, page = 1, pageSize = 12 } = params;

  try {
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/courses", {
      query: { field, delivery, kind, level, ...priceBandQuery(price), page, page_size: pageSize },
      next: { revalidate: 60, tags: ["courses"] },
    });
    return {
      items: res.data.map(mapCourse),
      page: res.meta.pagination.page,
      pageSize: res.meta.pagination.pageSize,
      pageCount: res.meta.pagination.pageCount,
      total: res.meta.pagination.total,
    };
  } catch {
    return emptyPage(page, pageSize);
  }
}

export async function getCourse(id: string): Promise<Course | null> {
  try {
    const res = await strapiFetch<StrapiSingleResponse<Record<string, unknown>>>(`/api/courses/${id}`, {
      next: { revalidate: 60, tags: ["courses", `course:${id}`] },
    });
    return res.data ? mapCourse(res.data) : null;
  } catch {
    return null;
  }
}

/* ---- Field → accent mapping (used sparingly; one accent per page) ---- */
export const FIELD_ACCENT: Record<Field, string> = {
  Digital: "var(--tv-accent-blue)",
  Technical: "var(--tv-accent-green)",
  Craft: "var(--tv-accent-green)",
  Creative: "var(--tv-accent-magenta)",
};

/* ============================================================
   SHOP / MERCH
   Catalog lives on-platform; cart + checkout + payments are
   handled by Shopify. Each product links out to its Shopify page.
   ============================================================ */

export const SHOPIFY_STORE_URL = "https://thrivingvillage.myshopify.com";

export type ProductCategory = "Apparel" | "Accessories" | "Electronics" | "Tools" | "Furniture" | "Home";

export type ProductType =
  | "Tee"
  | "Sweatshirt"
  | "Hoodie"
  | "Apron"
  | "Cap"
  | "Tote"
  | "Sticker"
  | "Laptop"
  | "Phone"
  | "Tablet"
  | "Monitor"
  | "Headphones"
  | "Keyboard"
  | "Charger"
  | "Drill"
  | "Toolkit"
  | "Mug"
  | "Notebook"
  | "Desk"
  | "Stool"
  | "Shelf";

export type ProductCondition = "New" | "Used" | "Refurbished";

export const CONDITIONS: ProductCondition[] = ["New", "Used", "Refurbished"];

export const CATEGORY_TYPES: Record<ProductCategory, ProductType[]> = {
  Apparel: ["Tee", "Sweatshirt", "Hoodie", "Apron"],
  Accessories: ["Cap", "Tote", "Sticker"],
  Electronics: ["Laptop", "Phone", "Tablet", "Monitor", "Headphones", "Keyboard", "Charger"],
  Tools: ["Drill", "Toolkit"],
  Furniture: ["Desk", "Stool", "Shelf"],
  Home: ["Mug", "Notebook"],
};

export type Product = {
  id: string; // = slug
  name: string;
  category: ProductCategory;
  type: ProductType;
  price: number;
  seed: string;
  blurb: string;
  details: string[];
  sizes?: string[];
  maker?: string;
  condition?: ProductCondition;
  brand?: string;
  shopifyUrl: string;
};

export const productMeta = (p: Product): string => {
  if (p.maker) return p.maker;
  if (p.brand || (p.condition && p.condition !== "New")) {
    return [p.condition ?? "New", p.brand].filter(Boolean).join(" · ");
  }
  return "Thriving Village";
};

function mapProduct(raw: Record<string, unknown>): Product {
  return {
    id: String(raw.slug),
    name: String(raw.name),
    category: raw.category as ProductCategory,
    type: raw.type as ProductType,
    price: Number(raw.price),
    seed: String(raw.seed ?? raw.slug),
    blurb: String(raw.blurb ?? ""),
    details: (raw.details as string[]) ?? [],
    sizes: (raw.sizes as string[]) || undefined,
    maker: (raw.maker as string) || undefined,
    condition: (raw.condition as ProductCondition) || undefined,
    brand: (raw.brand as string) || undefined,
    shopifyUrl: String(raw.shopifyUrl),
  };
}

export async function getProducts(
  params: {
    category?: ProductCategory;
    type?: ProductType;
    condition?: ProductCondition;
    price?: PriceBand;
    query?: string;
    sort?: "featured" | "price-asc" | "price-desc";
    page?: number;
    pageSize?: number;
  } = {},
): Promise<Paginated<Product>> {
  const { category, type, condition, price, query, sort, page = 1, pageSize = 24 } = params;

  const ordering = sort === "price-asc" ? "price" : sort === "price-desc" ? "-price" : undefined;

  try {
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/products", {
      query: {
        category,
        type,
        condition,
        ...priceBandQuery(price),
        search: query,
        ordering,
        page,
        page_size: pageSize,
      },
      next: { revalidate: 60, tags: ["products"] },
    });
    return {
      items: res.data.map(mapProduct),
      page: res.meta.pagination.page,
      pageSize: res.meta.pagination.pageSize,
      pageCount: res.meta.pagination.pageCount,
      total: res.meta.pagination.total,
    };
  } catch {
    return emptyPage(page, pageSize);
  }
}

export async function getProduct(id: string): Promise<Product | null> {
  try {
    const res = await strapiFetch<StrapiSingleResponse<Record<string, unknown>>>(`/api/products/${id}`, {
      next: { revalidate: 60, tags: ["products", `product:${id}`] },
    });
    return res.data ? mapProduct(res.data) : null;
  } catch {
    return null;
  }
}

/* ============================================================
   FEATURED BRANDS
   ============================================================ */

export type BrandKind = "Sister business" | "Partner";

export type Brand = {
  id: string;
  name: string;
  kind: BrandKind;
  industry: string;
  tagline: string;
  seed: string;
  url: string;
  featured?: boolean;
};

function mapBrand(raw: Record<string, unknown>): Brand {
  return {
    id: String(raw.documentId),
    name: String(raw.name),
    kind: raw.kind as BrandKind,
    industry: String(raw.industry),
    tagline: String(raw.tagline),
    seed: String(raw.seed ?? raw.documentId),
    url: String(raw.url),
    featured: Boolean(raw.featured),
  };
}

export async function getBrands(params: { kind?: BrandKind; featured?: boolean } = {}): Promise<Brand[]> {
  const { kind, featured } = params;

  try {
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/brands", {
      query: { kind, featured, ordering: "name" },
      next: { revalidate: 60, tags: ["brands"] },
    });
    return res.data.map(mapBrand);
  } catch {
    return [];
  }
}

/* ---- Lookups / placeholder images ---- */
export const photo = (seed: string, w = 600, h = 400) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}?grayscale`;

export const WHATSAPP_URL = "https://whatsapp.com/channel/0029VbCwI97K5cDExM8g2z0Q";

/* ============================================================
   TESTIMONIALS
   ============================================================ */

export type Testimonial = { quote: string; name: string; role: string };

export async function getTestimonials(): Promise<Testimonial[]> {
  try {
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/testimonials", {
      next: { revalidate: 300, tags: ["testimonials"] },
    });
    return res.data.map((t) => ({ quote: String(t.quote), name: String(t.name), role: String(t.role) }));
  } catch {
    return [];
  }
}

/* ============================================================
   SESSION-SCOPED READS (dashboard / saved jobs / lesson progress)
   These always hit the backend live (`noStore`) — small, per-user,
   never worth caching across users.
   ============================================================ */

export type ApplicationStatus =
  | "Applied"
  | "In review"
  | "Interview"
  | "Shortlisted"
  | "Closed"
  | "Archived";
export type EntryStatus = "Submitted" | "Shortlisted" | "Won" | "Not selected";

export async function getMyApplications(
  token: string,
): Promise<{ jobId: string; status: ApplicationStatus; appliedAgo: string }[]> {
  try {
    const res = await strapiFetch<{ data: { jobId: string; status: ApplicationStatus; appliedAgo: string }[] }>(
      "/api/me/applications",
      { token, noStore: true },
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

/* ---- Admin: job applicants ---- */

export type JobApplicant = {
  documentId: string;
  name: string;
  whatsapp: string;
  message: string | null;
  portfolioUrl: string | null;
  videoUrl: string;
  status: ApplicationStatus;
  appliedAgo: string;
  cv: { url: string; name: string; size: number } | null;
};

function absoluteMediaUrl(url: string): string {
  return url.startsWith("http") ? url : `${STRAPI_URL}${url}`;
}

/** Admin-only: everyone who applied to one job, attachments included. */
export async function getJobApplicants(jobSlug: string, token: string): Promise<JobApplicant[]> {
  try {
    const res = await strapiFetch<{ data: Record<string, unknown>[] }>(`/api/jobs/${jobSlug}/applicants`, {
      token,
      noStore: true,
    });
    return (res.data ?? []).map((r) => {
      const cv = r.cv as Record<string, unknown> | null;
      return {
        documentId: String(r.documentId),
        name: String(r.name),
        whatsapp: String(r.whatsapp),
        message: r.message ? String(r.message) : null,
        portfolioUrl: r.portfolioUrl ? String(r.portfolioUrl) : null,
        videoUrl: String(r.videoUrl ?? ""),
        status: r.status as ApplicationStatus,
        appliedAgo: String(r.appliedAgo ?? ""),
        cv: cv ? { url: absoluteMediaUrl(String(cv.url)), name: String(cv.name ?? "CV"), size: Number(cv.size ?? 0) } : null,
      };
    });
  } catch {
    return [];
  }
}

export async function getMyEntries(
  token: string,
): Promise<{ contestId: string; status: EntryStatus; submittedAgo: string }[]> {
  try {
    const res = await strapiFetch<{ data: { contestId: string; status: EntryStatus; submittedAgo: string }[] }>(
      "/api/me/entries",
      { token, noStore: true },
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

export async function getMyCourses(token: string): Promise<{ courseId: string; progress: number }[]> {
  try {
    const res = await strapiFetch<{ data: { courseId: string; progress: number }[] }>("/api/me/courses", {
      token,
      noStore: true,
    });
    return res.data ?? [];
  } catch {
    return [];
  }
}

/** Saved-job slugs for the current user — fetched once per list-page render, not per card. */
export async function getSavedJobSlugs(token: string): Promise<Set<string>> {
  try {
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/saved-jobs", {
      token,
      noStore: true,
    });
    const slugs = res.data
      .map((row) => (row.job as Record<string, unknown> | undefined)?.slug)
      .filter((s): s is string => typeof s === "string");
    return new Set(slugs);
  } catch {
    return new Set();
  }
}

/** Completed lesson keys for one course — used to hydrate LessonViewer's checkmarks. */
export async function getCourseLessonProgress(token: string, courseDbId: number): Promise<Set<string>> {
  try {
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/lesson-progresses", {
      query: { courseId: courseDbId },
      token,
      noStore: true,
    });
    return new Set(res.data.map((row) => String(row.lessonKey)));
  } catch {
    return new Set();
  }
}

export async function getAdminStats(
  token: string,
): Promise<{ label: string; value: string; delta: string }[]> {
  try {
    const res = await strapiFetch<{ data: { label: string; value: string; delta: string }[] }>(
      "/api/admin-dashboard/stats",
      { token, noStore: true },
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}

export async function getAdminActivity(
  token: string,
): Promise<{ who: string; what: string; when: string }[]> {
  try {
    const res = await strapiFetch<{ data: { who: string; what: string; when: string }[] }>(
      "/api/admin-dashboard/activity",
      { token, noStore: true },
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}
