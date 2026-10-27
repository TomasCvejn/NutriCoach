# NutriCoach

Nutrition coaching app for coaches and their clients (general and sports nutrition). Built by a Ralph loop: Claude runs in a loop, each iteration starts with a fresh context and completes one item from the plan.

- `specs/` — what to build (source of truth, edit freely)
- `IMPLEMENTATION_PLAN.md` — todo list, generated and maintained by the loop
- `PROMPT_plan.md`, `PROMPT_build.md` — prompts for each mode
- `CLAUDE.md` — commands and gotchas, read by Claude every iteration

## Running

```bash
./loop.sh plan 1        # create IMPLEMENTATION_PLAN.md from specs
./loop.sh build 5       # 5 iterations, each = 1 item + commit
./loop.sh build         # until it prints <ralph>DONE</ralph>
MODEL=sonnet ./loop.sh build 10   # cheaper model
```

Between runs, review `git log` and the plan. If the loop goes the wrong way, fix the specs or the plan (or delete the plan and run `plan` again), not the code.

The loop runs with a tool allowlist (files, npm/npx/node, git commit). Through `npx` it can still run anything, so a container or VM is the safest place to run it.
