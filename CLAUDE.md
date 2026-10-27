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
- `npm run test:e2e` — Playwright (fresh `e2e.db`, `next dev` on :3100 because dev login is refused in production; Next allows one `next dev` per directory, so stop your own `npm run dev` first). Sign in with `logIn(page, email)` from `e2e/dev-login.ts`
- `npx prisma migrate dev --name <name> && npx prisma generate` — schema change (Prisma 7 `migrate dev` doesn't regenerate the client)
- `npm run db:seed` — reset demo data (coach@demo.cz, general@ / sports@ / race@demo.cz; sign in via dev login)
- `npm run coach:create -- --email … --name …` — new coach account (signs in with Google)

## Gotchas
- `create-next-app` refuses a non-empty directory: scaffold into a temp subfolder, then move the files up (keep the existing `.gitignore` lines).
- Prisma 7 blocks `prisma migrate reset` for AI agents: reset with `npm run db:seed` (deletes the SQLite file + `migrate deploy`). Never run `prisma init`: it writes a `.env` and agent skills into `.agents/`, `.windsurf/`, `.claude/skills/`.
- Better Auth rejects cookie-carrying POSTs without an `Origin` header (CSRF check, skipped under Vitest): API calls in Playwright need `headers: { origin: baseURL }`.
- Better Auth checks the Prisma schema on every request and fails all of them if one of its columns is missing (e.g. the unused `account.password`): never drop a Better Auth column.
- taste scripts need Chrome: `loop.sh` sets `CHROME_PATH` to Playwright's Chromium; elsewhere `export CHROME_PATH=$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome | tail -1)`.
