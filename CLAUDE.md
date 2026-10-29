# NutriCoach

Nutrition coaching app (coach + clients). Specs: `specs/`. Task list: `IMPLEMENTATION_PLAN.md`. Built by a Ralph loop (`./loop.sh`, prompts `PROMPT_*.md`).

## Language
- Code, comments, README, docs and commit messages in English. User-facing text only through i18n (`cs` + `en`).

## Skills
- Always use the `ponytail` skill for every code change. Specs are the explicit request: never simplify away anything they require.
- Always use the `design-taste-frontend` (taste) skill for every UI screen; app screens follow its `references/app-screens.md` run.
- One design direction for the whole app: the first UI item draws it (`draw.mjs --app … --out .taste-skill/app`) and puts palette and type into the Tailwind theme. Later screens reuse it (`draw.mjs --show --out .taste-skill/app`), never draw again.
- Conflicts: ponytail decides the code (no extra abstractions or dependencies), taste decides how screens look.

## Commands (created by the scaffold item — keep this list true)
- `npm run dev` — dev server
- `npm run check` — typecheck + lint + unit tests; must pass before every commit
- `npm run test:e2e` — Playwright (fresh `e2e.db`, `next dev` on :3100 because dev login is refused in production; it builds into `.next-e2e` via `NEXT_DIST_DIR`, so a running `npm run dev` can stay). Sign in with `logIn(page, email)` from `e2e/dev-login.ts`
- `npx prisma migrate dev --name <name> && npx prisma generate` — schema change (Prisma 7 `migrate dev` doesn't regenerate the client). A change that drops data makes `migrate dev` refuse non-interactively: `mkdir prisma/migrations/<YYYYMMDDHHMMSS>_<name> && npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script -o prisma/migrations/<…>/migration.sql`, then `npm run db:seed`
- `npm run db:seed` — reset demo data (coach@demo.cz, general@ / sports@ / race@demo.cz; sign in via dev login)
- `npm run coach:create -- --email … --name …` — new coach account (signs in with Google)

## Gotchas
- `create-next-app` refuses a non-empty directory: scaffold into a temp subfolder, then move the files up (keep the existing `.gitignore` lines).
- A Json `@default("{}")` on a table Prisma redefines (SQLite) comes out unquoted in migration.sql (`DEFAULT {}`) and fails to apply: quote it (`DEFAULT '{}'`), then `npm run db:seed`. (`[]` happens to pass.)
- Prisma 7 blocks `prisma migrate reset` for AI agents: reset with `npm run db:seed` (deletes the SQLite file + `migrate deploy`). Never run `prisma init`: it writes a `.env` and agent skills into `.agents/`, `.windsurf/`, `.claude/skills/`.
- Better Auth rejects cookie-carrying POSTs without an `Origin` header (CSRF check, skipped under Vitest): API calls in Playwright need `headers: { origin: baseURL }`.
- Better Auth checks the Prisma schema on every request and fails all of them if one of its columns is missing (e.g. the unused `account.password`): never drop a Better Auth column.
- `npm run db:seed` deletes and recreates the SQLite file: restart a running `next dev` afterwards (it keeps the old file open). Same after a migration that changes existing tables: it keeps the old Prisma client in memory ("column … does not exist"). `npx shadcn add` asks before overwriting `button.tsx`: answer with `printf 'n\n' | npx shadcn@4 add <name>`.
- A client created in a test (invite, `createUser`) hasn't onboarded: `/app` redirects to `/onboarding` until `Client.onboardingCompletedAt` is set (seeded clients are done). To snap a mid-onboarding screen, accept `/invite/demo-invite` first (`.taste-skill/onboarding-steps.mjs` does it and snaps every step).
- e2e on a phone: the Next dev indicator (bottom-left) covers the first bottom tab, so a click on "Dnes" / "Today" never lands; use `page.goto("/app")`.
- e2e: after `logIn()` wait for the role home (`await expect(page).toHaveURL("/coach")`) before `page.goto(...)`, or the navigation aborts the dev-login action and lands on `/login`.
- `inspect.mjs` can't sign in: with `npm run dev` on :3000, `node .taste-skill/snap.mjs coach@demo.cz:/coach …` saves static snapshots to inspect, and `--out` must sit under `.taste-skill/app/` or the inspector judges by page rules instead of app rules.
- Snapshots of a stale `dev.db` (seeded before later migrations) show wrong data: snap a side server instead (seed `e2e.db`, then `npx next dev -p 3100` with `DATABASE_URL=file:./e2e.db`, `NEXT_DIST_DIR=.next-e2e` through the `node -e` env pattern below, and `SNAP_BASE=http://localhost:3100`); stop it before `npm run test:e2e`, which needs :3100 (`pkill -f "next dev -p 310[0]"` in a Bash call of its own: a pattern that matches its own command line — or one in a call that also contains "next dev -p 3100" — kills the shell running it).
- In `loop.sh` runs, `VAR=x cmd`, pipes and `;` chains need approval: set env through `node -e "require('child_process').execSync('npm run db:seed', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: 'file:./e2e.db' } })"`.
- taste scripts need Chrome: `loop.sh` sets `CHROME_PATH` to Playwright's Chromium; elsewhere (where `export CHROME_PATH=$(…)` is blocked) pass `CHROME_PATH: require('@playwright/test').chromium.executablePath()` in the `node -e` execSync env pattern above.
