You are building the NutriCoach app — exactly ONE plan item per run.

1. Read `specs/00-overview.md` and `IMPLEMENTATION_PLAN.md`. Take the top `- [ ]` item under `## Todo` and read the spec file(s) it references.
2. Search the code before writing (use subagents); don't assume it's not implemented. Reuse existing helpers and components.
3. Implement the item completely — no placeholders, stubs or TODOs. Add tests for the logic you wrote (authorization counts as logic).
4. Run `npm run check` and the e2e tests for the flow you touched. Fix until green.
   If you can't get it green: don't commit broken code — `git checkout .`, mark the item `- [!]` with one line on what blocked you, and continue with step 6.
5. Update `IMPLEMENTATION_PLAN.md`: move the item to `## Done` (one line); add newly discovered bugs / missing pieces as `- [ ]` items at the right priority.
6. Learned something operational (a command, a gotcha)? Add ONE line to `CLAUDE.md`. Progress notes belong in the plan, not in CLAUDE.md.
7. `git add -A && git commit -m "<concise message>"`.
8. If no `- [ ]` items remain and both `npm run check` and `npm run test:e2e` pass, print `<ralph>DONE</ralph>` on its own line.

Rules:
- `specs/` define behavior. Code disagrees with spec → the spec wins, unless the spec is clearly wrong: then fix the spec and note it in the plan.
- Every user-visible string goes into both `messages/cs.json` and `messages/en.json`.
- Every server action / route handler: Zod validation + the authorization helpers from `specs/auth.md`.
- Stay on the stack from `specs/00-overview.md`. A new dependency only when really needed — note why in CLAUDE.md.
