# Thriving Village — Frontend Skin

The UI/UX shell for **Thriving Village**, a Nigerian-born platform for human
empowerment across Africa. It connects African talent to real opportunities
through three paths: a **job board**, **talent contests**, and a **learning
platform**. The community lives off-platform on WhatsApp.

> **Scope:** this is the **frontend skin only** — pages, layouts, components, and
> the design system. No backend, no real auth, no real payments. Data is mocked
> (`src/lib/data.ts`) and actions are placeholders (forms toast on submit). The
> in-house dev team wires up functionality.

Built to the **Thriving Village Design System** handoff from Claude Design:
neutral-first palette, Instrument Sans (tight tracking) + Libre Baskerville,
pill buttons (never boxy, never accent-filled), at most one accent per page,
black-&-white photography.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4 (design tokens mapped in `src/app/globals.css`)
- `lucide-react` icons
- Custom toast system (`src/components/ui/Toaster.tsx`) — swappable for sonner

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (all routes prerender)
npm run lint
```

## Routes

**Public** — `/`, `/jobs`, `/jobs/[id]`, `/contests`, `/contests/[id]`,
`/courses`, `/courses/[id]`, `/courses/[id]/lessons/[lessonId]`, `/about`,
`/auth/signin`, `/auth/signup`

**Authenticated** — `/dashboard`, `/dashboard/courses`,
`/dashboard/applications`, `/dashboard/contests`

**Admin** — `/admin`, `/admin/jobs`, `/admin/contests`, `/admin/courses`

## Project structure

```
src/
  app/
    (public)/        # marketing + product pages (Navbar + Footer chrome)
    auth/            # sign in / sign up (split-panel layout)
    dashboard/       # talent dashboard (AppShell + sidebar)
    admin/           # admin area (AppShell + sidebar)
    globals.css      # design tokens + Tailwind theme mapping
    layout.tsx       # fonts + Toaster
  components/
    ui/              # design-system primitives (Button, Card, Badge, Tag,
                     # Input, Select, Textarea, FileUpload, Avatar, Logo,
                     # Modal, Toaster, Skeleton, EmptyState, ProgressBar, …)
    layout/          # Navbar, Footer, AppShell, SidebarNav
    cards/           # JobCard, ContestCard, CourseCard, ApplyDialog
    course/          # LessonViewer
    admin/           # AdminCrud (generic list + create/edit/delete)
  lib/
    data.ts          # mock data (jobs, contests, courses, dashboard, admin)
    utils.ts         # cn(), naira()
public/brand/        # logo mark + wordmarks (black/white, SVG + PNG)
```

## Wiring it up (notes for the dev team)

- **Auth** — `/auth/*` forms are UI-only; the sign-up role selector
  (talent / employer) holds local state. Hook to your auth provider.
- **Data** — replace `src/lib/data.ts` reads with real fetches. Card and page
  components take typed props, so swapping the source is localized.
- **Actions** — `ApplyDialog` (apply / enroll / submit) and `AdminCrud`
  (create / edit / delete) call `toast.*` placeholders. Replace with mutations.
- **Money** — `naira()` formats all prices; values are plain numbers in mock data.
- **Images** — grayscale placeholders via `picsum.photos` (allowed in
  `next.config.ts`). Swap for real black-&-white photography per the brand.
