# NutriCoach — overview

Nutrition coaching platform for general and sports nutrition (like TrueCoach, but nutrition-first). A **coach** works with many **clients**: sets each client's program, nutrition plan, fueling and competition plans, reviews check-ins. The client follows the plan, tracks what their tracking mode asks for, and submits weekly check-ins.

Devices: clients on phones (mobile-first, bottom nav), coach on desktop (sidebar, still usable on phone).

## Programs and tracking modes — the core concept
Each client has exactly one **program** and one **tracking mode**. The coach sets both (pre-filled from the invite / onboarding) and can change them any time; changing never deletes data.

| Program | For | Extra features |
|---|---|---|
| `GENERAL` | health, body composition, everyday eating | — |
| `SPORTS` | athletes in regular training | training dashboard, fueling plans, training-specific hydration |
| `COMPETITION` | athletes preparing for a competition | everything in SPORTS + competition dashboard, timeline, competition-day schedule |

| Tracking mode | Daily nutrition screen |
|---|---|
| `CALORIES` | food logging with kcal / macro / micronutrient totals vs. targets |
| `PORTIONS` | hand-portion counting (protein palms, carb cupped hands, veg fists, fat thumbs) vs. portion targets |
| `GUIDANCE` | no numbers: per planned meal "followed? yes / partly / no", optional meal photo |

Everything else (nutrition plan, recipes, hydration, check-ins, progress, body composition, bloodwork, supplements, messages, calendar) is available in every program. Navigation and home widgets show only what the client's program and mode use.

**Day type** per date: `REST`, `TRAINING`, `COMPETITION`. Derived: competition that day → COMPETITION; any training session → TRAINING; else REST. Client or coach can override it for a date. GENERAL clients use only REST targets. Pure function with unit tests.

## Stack (fixed — do not switch)
- Next.js (latest stable, App Router, Server Components + Server Actions), React, TypeScript `strict`
- Prisma + SQLite
- Better Auth (email + password) with the Prisma adapter
- next-intl for i18n
- Tailwind CSS + shadcn/ui, Recharts for charts, Zod for all input validation
- Vitest (unit/integration), Playwright (e2e for critical flows)
- npm

No other services: no Redis, no S3, no external auth, no email sending. The app must run with `npm install && npm run db:seed && npm run dev`.

## Conventions
- Every mutation (Server Action / route handler) validates input with Zod and goes through the authorization helpers from `auth.md`.
- Metric units only (g, kg, cm, ml). Energy in kcal, sodium in mg.
- Calendar days are `YYYY-MM-DD` strings in the client's timezone (stored on the user). Never derive "today" from server UTC.
- Uploads (photos, PDFs) go to local `uploads/` (gitignored), jpg/png/webp/pdf, max 10 MB, served only through an authenticated route handler.
- Health data (body composition, bloodwork, photos, check-ins) is visible only to the client and their coach.
- "Realtime" = polling. No websockets.
- In-app notifications go through one `notify()` helper (see `home-and-basics.md`).

## i18n
- Locales `cs` (default) and `en`, stored on the user (cookie for logged-out pages). No locale prefix in URLs.
- Every UI string goes through next-intl: `messages/cs.json`, `messages/en.json`. A unit test asserts both files have identical key sets.
- Numbers and dates formatted with the active locale (`1 234,5 g` in cs).
- Content written by people (recipes, recommendations, notes, plans) is stored as written — not translated. Seeded content exists in both languages.
- Open Food Facts names: `product_name_cs` / `product_name_en` with fallback to `product_name`.

## Seed
Demo coach `coach@demo.cz` / `demo1234` and three clients (password `demo1234`), each with two weeks of data:
- `general@demo.cz` — GENERAL, PORTIONS
- `sports@demo.cz` — SPORTS, CALORIES (training sessions, fueling)
- `race@demo.cz` — COMPETITION, CALORIES (competition 10 days out, timeline, race-day schedule)
Plus a GUIDANCE client can be created by switching any of them.

## Build order (for planning)
1. Scaffold, tooling (`npm run check`, `npm run test:e2e`), Prisma, seed skeleton, i18n wiring (the login screen already needs it)
2. Auth, roles, invites, coach CLI — `auth.md`
3. App shells (coach sidebar, client bottom nav, program/mode-aware), notifications helper, language + timezone settings — `home-and-basics.md`
4. Onboarding + client profile — `onboarding-profile.md`
5. Coach client list + individual client dashboard skeleton + coach notes — `coach.md`
6. Nutrition plan + editor — `nutrition.md`
7. Daily nutrition: CALORIES (food database), then PORTIONS, then GUIDANCE — `nutrition.md`
8. Recipe library — `recipes.md`
9. Hydration — `training.md`
10. Weekly check-in, feedback, review — `check-ins.md`
11. Progress + body composition — `progress.md`
12. Training + fueling — `training.md`
13. Competitions — `competition.md`
14. Supplements — `supplements.md`
15. Messaging — `messaging.md`
16. Calls, calendar, coach home — `coach.md`, `home-and-basics.md`
17. Bloodwork — `progress.md`
18. Settings, package, help/FAQ, privacy & account — `home-and-basics.md`
Client home and coach home grow with every feature: when a feature lands, add its widget.

## Out of scope
- Phase 2: education hub / lessons, community feed, community events & Q&A, coach profile page, chat availability indicator.
- Payment processing, workout programming (sessions are logged, not programmed), native apps, email/push notifications, AI features, wearable integrations, imperial units.
