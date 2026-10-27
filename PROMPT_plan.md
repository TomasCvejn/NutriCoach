You are planning the NutriCoach app. PLANNING ONLY — do not write application code.

1. Read every file in `specs/` and `IMPLEMENTATION_PLAN.md` (if it exists).
2. Study the existing code (`src/`, `prisma/`, `messages/`, tests). Use subagents to search in parallel. Never assume something is missing — confirm by searching.
3. Gap analysis: specs vs. code. (Re)write `IMPLEMENTATION_PLAN.md`:
   - `## Todo` ordered by priority — follow "Build order" in `specs/00-overview.md`, unblockers first.
   - Each item fits one iteration (one commit): `- [ ] <what> — <spec file> — <how to verify>`.
   - `## Done` at the bottom, one line per item (keep existing ones).
   - `## Notes`: bugs found, missing tests, spec ambiguities with the resolution you chose.
4. If a spec is contradictory or misses something essential, fix the spec minimally and mention it in Notes.
5. `git add -A && git commit -m "plan: <summary>"`.
