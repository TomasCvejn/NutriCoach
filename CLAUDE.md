# NutriCoach

Nutrition coaching app (coach + clients). Specs: `specs/`. Task list: `IMPLEMENTATION_PLAN.md`. Built by a Ralph loop (`./loop.sh`, prompts `PROMPT_*.md`).

## Skills
- Always use the `ponytail` skill for every code change. Specs are the explicit request: never simplify away anything they require.
- Always use the `design-taste-frontend` (taste) skill for every UI screen; app screens follow its `references/app-screens.md` run.
- One design direction for the whole app: the first UI item draws it (`draw.mjs --app … --out .taste-skill/app`) and puts palette and type into the Tailwind theme. Later screens reuse it (`draw.mjs --show --out .taste-skill/app`), never draw again.
- Conflicts: ponytail decides the code (no extra abstractions or dependencies), taste decides how screens look.

## Commands (created by the scaffold item — keep this list true)
- `npm run dev` — dev server
- `npm run check` — typecheck + lint + unit tests; must pass before every commit
- `npm run test:e2e` — Playwright
- `npx prisma migrate dev --name <name>` — schema change
- `npm run db:seed` — reset demo data (coach@demo.cz, general@ / sports@ / race@demo.cz, all `demo1234`)
- `npm run coach:create -- --email … --name … --password …` — new coach account

## Gotchas
- `create-next-app` refuses a non-empty directory: scaffold into a temp subfolder, then move the files up (keep the existing `.gitignore` lines).
- taste scripts need Chrome: `loop.sh` sets `CHROME_PATH` to Playwright's Chromium; elsewhere `export CHROME_PATH=$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome | tail -1)`.
