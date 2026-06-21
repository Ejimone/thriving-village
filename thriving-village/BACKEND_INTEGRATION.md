# Backend Integration Guide

This frontend is a **skin** — every screen renders, but all data is mocked and
every action is a placeholder. This doc tells you exactly what to wire and where,
so the UI keeps working as you replace mocks with real services.

**TL;DR**
1. All mock data lives in one file: [`src/lib/data.ts`](src/lib/data.ts).
2. All write actions live in a handful of components that currently call
   `toast.*` — search the repo for `toast.success` / `toast.info`.
3. Component props are already typed. Swap the data source, keep the types, and
   the pages don't change.

---

## 0. Recommended architecture

This is a recommendation, not a constraint — adapt to your team's strengths.

**Shape: a modular monolith, not microservices.** Keep the backend inside this
Next.js app — Server Components for reads, Route Handlers + Server Actions for
writes — organised into domain modules (jobs, contests, courses, shop, brands,
identity, notifications). One deployable, one language, typed end to end. Split a
domain into its own service later, only if real load demands it.

```
client (web/mobile, PWA)
   │
CDN / edge cache  ── ISR + revalidateTag() on admin edits
   │
Next.js app  ── RSC · server actions · route handlers
   ├── PostgreSQL (Supabase) · Drizzle ORM · full-text search
   ├── Auth — WhatsApp/phone OTP · roles (talent/employer/admin) via RLS
   └── managed services:
         Payments → Paystack        Shop → Shopify
         Video → Cloudflare Stream  Media/CDN → Cloudflare R2
         Notifications → WhatsApp Cloud API
         Background jobs → Inngest
```

**Recommended stack**

| Concern | Pick | Notes (Nigeria / Africa) |
| --- | --- | --- |
| DB | PostgreSQL (Supabase) + Drizzle | Bundles Postgres + Auth + Storage + RLS + Realtime — high leverage for a lean team. |
| Auth | Phone / WhatsApp OTP (Supabase Auth + e.g. Termii) | Audience lives on WhatsApp; OTP beats email/password. Roles via JWT claims + RLS. |
| Payments | **Paystack** (or Flutterwave) | NG-first: cards, bank transfer, USSD. Not Stripe. Course unlocks + contest payouts via Transfers API. |
| Shop | Shopify | Owns cart/checkout/inventory; sync catalog + consume order webhooks. |
| Course video | Cloudflare Stream | Adaptive bitrate for variable bandwidth; signed URLs gate paid access. |
| Images / files | Cloudflare R2 + Images | Zero egress fees; on-the-fly resize for logos, brand tiles, products, submissions. |
| Search / filters | Postgres FTS (`tsvector`, `pg_trgm`) first | Move client-side filters server-side with indexes. Add Typesense/Meilisearch only if outgrown. |
| Background jobs | Inngest | Durable, retryable workflows: payouts, notifications, video + payment webhooks, judging deadlines. |
| Notifications | WhatsApp Cloud API | Application status, contest results, course nudges. |
| Observability | Sentry + PostHog | Errors + product analytics. |

**Optimization levers**
1. Cache public read-heavy pages (job board, course catalog, shop, brands) with
   ISR / Cache Components behind a CDN; invalidate with `revalidateTag()` on admin
   writes. Most traffic never hits the DB.
2. Use the Supabase / PgBouncer connection pooler (serverless + Postgres).
3. Never serve heavy media yourself — Cloudflare Stream (video) + R2/Images
   (AVIF/WebP, responsive sizes). Biggest perf + cost lever for a mobile audience.
4. Index for the exact filter combos (shop: category/type/condition/price; jobs:
   field/location/level).
5. Keep writes async — payment confirmation, payouts, notifications run through
   webhooks + Inngest, never blocking a request.

**Phasing**
- **MVP:** Next.js + Supabase (DB/Auth/Storage) + Paystack + Shopify + Postgres
  FTS + WhatsApp OTP.
- **V2:** Cloudflare Stream for courses, Inngest for payouts/notifications, PostHog.
- **At scale:** dedicated search, read replicas, extract a hot domain to its own service.

**Avoid early:** microservices, Kafka, Kubernetes, a separate search cluster,
self-hosted video — premature ops burden for a small team.

---

## 1. The data layer (read path)

Everything the pages read comes from `src/lib/data.ts`. It exports typed arrays
plus lookup helpers. Replace the array constants with real fetches and keep the
**type exports** — the rest of the app imports those types.

| Export | Type | Used by |
| --- | --- | --- |
| `JOBS` | `Job[]` | `/jobs`, home, dashboard, admin/jobs |
| `getJob(id)` | `Job \| undefined` | `/jobs/[id]` |
| `CONTESTS` | `Contest[]` | `/contests`, home, admin/contests |
| `getContest(id)` | `Contest \| undefined` | `/contests/[id]` |
| `COURSES` | `Course[]` | `/courses`, course detail, admin/courses |
| `getCourse(id)` | `Course \| undefined` | `/courses/[id]`, lessons |
| `MY_COURSES` | enrolled + `progress` | dashboard |
| `MY_APPLICATIONS` | application + `status` | dashboard/applications |
| `MY_ENTRIES` | contest entry + `status` | dashboard/contests |
| `ADMIN_STATS`, `ADMIN_ACTIVITY` | dashboard stats/feed | `/admin` |
| `TESTIMONIALS` | home testimonials | home |
| `naira(n)` | `string` formatter | everywhere money shows |
| `photo(seed,w,h)` | placeholder image URL | all imagery |
| `WHATSAPP_URL` | community link | nav, footer, CTAs |

### Recommended approach (Server Components)

Most read pages are **React Server Components**, so you can fetch on the server
without client state. Turn the synchronous lookups into async fetches:

```ts
// today (mock)
export const getJob = (id: string) => JOBS.find((j) => j.id === id);

// later (real)
export async function getJob(id: string): Promise<Job | null> {
  const res = await fetch(`${API}/jobs/${id}`, { next: { revalidate: 60 } });
  return res.ok ? res.json() : null;
}
```

Pages already `await` params (e.g. `const { id } = await params`), so making the
data helpers async is a small change. Two list pages are **Client Components**
because they filter in-browser:

- `/jobs` — `src/app/(public)/jobs/page.tsx`
- `/courses` — `src/app/(public)/courses/page.tsx`

For these, either (a) keep client filtering and fetch the list in a parent server
component passed as a prop, or (b) move filtering to query params + server fetch.

---

## 2. Data shapes (the contract)

These are the types the UI expects. Match them in your API responses (or adapt in
the data helpers). Full definitions are in `src/lib/data.ts`.

```ts
type Field = "Digital" | "Technical" | "Craft" | "Creative";
type LocationType = "Remote" | "Onsite" | "Hybrid";
type ExperienceLevel = "Entry" | "Mid" | "Senior";

type Job = {
  id: string; title: string; org: string; orgKind: string;
  field: Field; location: string; locationType: LocationType;
  type: "Full-time" | "Part-time" | "Contract";
  level: ExperienceLevel; pay: string; postedAgo: string;
  summary: string; responsibilities: string[]; requirements: string[];
};

type ContestPrize = {
  place: number;            // 1 = top; used for ordering + leaderboard matching
  label: string;            // free text: "1st place", "Runner-up", "People's choice"
  amount: number;           // Naira; formatted with naira()
};

type Contest = {
  id: string; title: string; field: Field;
  prizes: ContestPrize[];   // one OR MORE winners — flexible per campaign
  entries: number; daysLeft: number;   // <= 0 means ended
  status: "live" | "past";
  brief: string; rules: string[]; seed: string;
};
// Helpers in data.ts: prizePool(c) = sum of amounts, topPrize(c) = largest,
// winnerCount(c) = c.prizes.length. The contest detail leaderboard matches an
// entrant's rank to prizes by `place` to show what each winner takes home.

type CourseDelivery = "Online" | "Onsite" | "Hybrid";
type CourseKind = "Course" | "Certification";

type Course = {
  id: string; title: string; field: Field; level: ExperienceLevel;
  kind: CourseKind;          // regular course vs. accredited certification
  delivery: CourseDelivery;  // online / onsite / hybrid
  location?: string;         // set for Onsite / Hybrid (e.g. "Lagos")
  instructor: string; instructorRole: string;
  price: number;             // Naira — ranges from a few thousand to seven figures
  weeks: number; lessonCount: number;
  seed: string; blurb: string; outcomes: string[];
  modules: { title: string; lessons: Lesson[] }[];
};
type Lesson = { id: string; title: string; duration: string; free?: boolean };
// Course filtering helpers in data.ts: PRICE_BANDS (UI options) +
// inPriceBand(price, band). The /courses page filters by field, delivery,
// kind, level, and price band.

type ApplicationStatus = "Applied" | "In review" | "Interview" | "Closed";
type EntryStatus = "Submitted" | "Shortlisted" | "Won" | "Not selected";
```

> **Money:** `prize` and `price` are plain numbers (Naira). The UI calls
> `naira(value)` to render `₦500,000`. Keep them numeric in the API.

> **Status strings** drive the `StatusBadge` styling
> (`src/components/ui/StatusBadge.tsx`). If you change the allowed values, update
> that map too.

---

## 3. Write actions (the placeholders to replace)

Every mutating action currently just shows a toast. Here's each one and what it
should become.

| Action | File | Currently | Wire to |
| --- | --- | --- | --- |
| Apply to job | `src/components/cards/ApplyDialog.tsx` | `toast.success(...)` | `POST /applications` |
| Submit contest entry | same (`ApplyDialog`) | toast | `POST /contests/:id/entries` |
| Enroll in course | same (`ApplyDialog`) | toast | `POST /enrollments` |
| Mark lesson complete | `src/components/course/LessonViewer.tsx` | local state + toast | `POST /progress` (lesson done) |
| Save/bookmark job | `src/components/cards/JobCard.tsx` | local state | `POST/DELETE /saved-jobs` |
| Admin create/edit/delete | `src/components/admin/AdminCrud.tsx` | toast | `POST/PATCH/DELETE` per resource |
| Sign in | `src/app/auth/signin/page.tsx` | timeout + toast | your auth provider |
| Sign up (role: talent/employer) | `src/app/auth/signup/page.tsx` | timeout + toast | your auth provider |

`ApplyDialog` is the shared apply/submit/enroll dialog. It collects name,
WhatsApp number, a note, and (optionally) a file, then calls `submit()`. Replace
the body of `submit()` with your API call and surface errors via `toast.error()`.

```tsx
// src/components/cards/ApplyDialog.tsx
function submit() {
  setOpen(false);
  toast.success(successMessage);   // <-- replace with real POST + error handling
}
```

`AdminCrud` is the generic admin table (list + create/edit/delete modal). Its
`save()` and the delete handler call `toast.*`. Pass real mutation callbacks in,
or call your API inside those handlers. The forms are currently uncontrolled
placeholders — add controlled state / a form library when you wire submission.

---

## 4. Auth

- Forms only, no real auth. Files: `src/app/auth/signin/page.tsx`,
  `src/app/auth/signup/page.tsx`.
- **Sign-up has a role selector: `talent` | `employer`** (`Role` type in the
  signup page). Persist this on the account — it should drive access to the
  employer/admin surfaces.
- Suggested gating once auth exists:
  - `/dashboard/**` → authenticated talent
  - `/admin/**` → admin/employer role
  - Use Next.js middleware (`middleware.ts`) for route protection.
- The current "user" is hardcoded as `"Ada Okonkwo"` in
  `src/app/dashboard/layout.tsx` (and `"Admin"` in `src/app/admin/layout.tsx`),
  passed to `AppShell`. Replace with the session user.

---

## 5. Per-surface checklist

**Job board** (`/jobs`, `/jobs/[id]`)
- List + filters (category/field, location type, experience level, text search).
  Filtering is client-side today; move to API query params for large datasets.
- Detail page reads one job; apply via `ApplyDialog`.

**Contests** (`/contests`, `/contests/[id]`)
- Split by `status` (`live` / `past`). `daysLeft` drives the countdown badge.
- Detail page has a **leaderboard placeholder** (`LEADERBOARD` constant inside
  `src/app/(public)/contests/[id]/page.tsx`) — replace with a real ranking feed.
- Submit via `ApplyDialog` (`withFile`).

**Courses** (`/courses`, `/courses/[id]`, lessons)
- Catalog + field filter. Detail shows curriculum from `course.modules`.
- Lesson view (`src/components/course/LessonViewer.tsx`): video is a
  **placeholder** — drop in your player. Completion is local state; persist via a
  progress endpoint and hydrate `completed` from the server.

**Shop / merch** (`/shop`, `/shop/[id]`)
- Catalog only — **Shopify owns cart, checkout, payments, and inventory.**
- Reads `PRODUCTS` from `data.ts`; each product has a `shopifyUrl`. The "Buy on
  Shopify" button (`src/components/shop/ProductPurchase.tsx`) opens that URL in a
  new tab. Replace `SHOPIFY_STORE_URL` + per-product `shopifyUrl` with real
  Shopify product/variant links (Buy Button, Storefront API, or hosted store).
- The shop is a community **marketplace** — not just merch, but gear people need
  (laptops, phones, tools, etc.), including **resale** (new / used / refurbished).
- Taxonomy: a broad `category` (Apparel / Accessories / Electronics / Tools /
  Furniture / Home) plus a granular `type` (Tee, Laptop, Phone, Drill, …).
  `CATEGORY_TYPES` maps each category to its types and drives the dependent type
  filter. Resale gear carries `condition` (`New` | `Used` | `Refurbished`) and a
  `brand`. The `/shop` page filters by search, category, type, condition, and
  price band, and sorts by price. `productMeta(p)` builds the card sub-line
  (maker for merch, `condition · brand` for gear). Mirror `category`/`type`/
  `condition` to Shopify product type, collections, and variants/metafields.
- The on-site size picker is UX only; Shopify is the source of truth for
  variants and stock. For deeper integration, map sizes to Shopify variant IDs
  and deep-link with `?variant=<id>`.

```ts
type ProductCategory = "Apparel" | "Accessories" | "Furniture" | "Home";
type ProductType =
  | "Tee" | "Sweatshirt" | "Hoodie" | "Apron"
  | "Cap" | "Tote" | "Sticker" | "Mug" | "Notebook"
  | "Desk" | "Stool" | "Shelf";
type Product = {
  id: string; name: string; category: ProductCategory; type: ProductType;
  price: number; seed: string; blurb: string; details: string[];
  sizes?: string[]; maker?: string; shopifyUrl: string;
};
```

**Brands** (`/brands`, home "Featured brands")
- Recognition / promotion for sister businesses and partners. Reads `BRANDS`
  from `data.ts`; the home page shows `featured` brands, `/brands` shows all with
  a kind filter (Our brands / Partners). Cards are poster tiles — the brand's
  own thumbnail (`seed` → real image) carries it, with just the name + a short
  `tagline` (5–8 words) overlaid. Cards link out to `brand.url` (external, new
  tab). No detail pages. `Brand = { id, name, kind, industry, tagline, seed,
  url, featured? }`.

**Dashboard** (`/dashboard/**`)
- Reads `MY_COURSES`, `MY_APPLICATIONS`, `MY_ENTRIES` — all scoped to the
  signed-in user. Replace with `GET /me/...` endpoints.

**Admin** (`/admin/**`)
- Overview reads `ADMIN_STATS` + `ADMIN_ACTIVITY`.
- Jobs/Contests/Courses use `AdminCrud` for list + CRUD.

---

## 6. Media

- Images use `picsum.photos` grayscale placeholders via `photo(seed, w, h)`.
- Allowed host is set in `next.config.ts` (`images.remotePatterns`). Add your
  real image/CDN host there, then replace `photo()` calls with real URLs.
- Brand keeps photography **black & white** — the `.tv-photo` utility (in
  `globals.css`) applies the grayscale treatment; keep it on real photos.

---

## 7. What you should NOT need to touch

- The design system (`src/components/ui/**`) and tokens (`globals.css`) — visual
  layer is done.
- Page layouts and routing — structure is final.
- `naira()`, `cn()` helpers (`src/lib/utils.ts`).

Keep the prop shapes and status strings stable and the UI will keep working as
you swap mocks for real services.
