/* ============================================================
   Data-access layer for the Thriving Village frontend.
   Every export here is backed by the real Strapi backend
   (see ../../documentation.md). Pages import the same names as
   before — only the array constants became async fetch functions.
   All money is in Naira.
   ============================================================ */

import { strapiFetch, type StrapiListResponse, type StrapiSingleResponse } from "./strapi";

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
  const filters: Record<string, unknown> = {};
  if (field) filters.field = { $eq: field };
  if (locationType) filters.locationType = { $eq: locationType };
  if (level) filters.level = { $eq: level };
  if (query) {
    filters.$or = [{ title: { $containsi: query } }, { org: { $containsi: query } }];
  }

  try {
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/jobs", {
      query: {
        filters,
        sort: "createdAt:desc",
        pagination: { page, pageSize },
        ...(full
          ? {}
          : {
              fields: [
                "title",
                "slug",
                "org",
                "orgKind",
                "field",
                "location",
                "locationType",
                "type",
                "level",
                "pay",
                "createdAt",
              ],
            }),
      },
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

export async function getJob(id: string): Promise<Job | null> {
  try {
    const res = await strapiFetch<StrapiSingleResponse<Record<string, unknown>>>(`/api/jobs/${id}`, {
      next: { revalidate: 60, tags: ["jobs", `job:${id}`] },
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
    status: raw.status as Contest["status"],
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
  const filters: Record<string, unknown> = {};
  if (status) filters.status = { $eq: status };

  try {
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/contests", {
      query: { filters, sort: "deadline:asc", pagination: { page, pageSize } },
      next: { revalidate: 60, tags: ["contests"] },
    });
    return {
      items: res.data.map(mapContest),
      page: res.meta.pagination.page,
      pageSize: res.meta.pagination.pageSize,
      pageCount: res.meta.pagination.pageCount,
      total: res.meta.pagination.total,
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

/** Translates a price band into Strapi `$gte`/`$lt` filter bounds (or none for "all"). */
function priceBandFilter(band?: PriceBand): Record<string, unknown> | undefined {
  switch (band) {
    case "under-50k":
      return { $lt: 50000 };
    case "50k-250k":
      return { $gte: 50000, $lt: 250000 };
    case "250k-1m":
      return { $gte: 250000, $lt: 1000000 };
    case "1m-plus":
      return { $gte: 1000000 };
    default:
      return undefined;
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
  const filters: Record<string, unknown> = {};
  if (field) filters.field = { $eq: field };
  if (delivery) filters.delivery = { $eq: delivery };
  if (kind) filters.kind = { $eq: kind };
  if (level) filters.level = { $eq: level };
  const priceFilter = priceBandFilter(price);
  if (priceFilter) filters.price = priceFilter;

  try {
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/courses", {
      query: { filters, sort: "createdAt:desc", pagination: { page, pageSize } },
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
  const filters: Record<string, unknown> = {};
  if (category) filters.category = { $eq: category };
  if (type) filters.type = { $eq: type };
  if (condition) filters.condition = { $eq: condition };
  const priceFilter = priceBandFilter(price);
  if (priceFilter) filters.price = priceFilter;
  if (query) filters.name = { $containsi: query };

  const sortParam =
    sort === "price-asc" ? "price:asc" : sort === "price-desc" ? "price:desc" : "createdAt:desc";

  try {
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/products", {
      query: { filters, sort: sortParam, pagination: { page, pageSize } },
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
  const filters: Record<string, unknown> = {};
  if (kind) filters.kind = { $eq: kind };
  if (featured !== undefined) filters.featured = { $eq: featured };

  try {
    const res = await strapiFetch<StrapiListResponse<Record<string, unknown>>>("/api/brands", {
      query: { filters, sort: "name:asc" },
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

export const WHATSAPP_URL = "https://chat.whatsapp.com/";

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

export type ApplicationStatus = "Applied" | "In review" | "Interview" | "Closed";
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
      query: { populate: { job: { fields: ["slug"] } }, pagination: { pageSize: 100 } },
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
      query: { courseId: courseDbId, pagination: { pageSize: 100 } },
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
