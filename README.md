# NutriCoach

Appka pro výživového kouče a klienty (obecná + sportovní výživa). Staví ji Ralph loop: Claude v cyklu, každá iterace začíná s čistým kontextem a udělá jednu položku z plánu.

- `specs/` — co se má postavit (zdroj pravdy, uprav podle sebe)
- `IMPLEMENTATION_PLAN.md` — todo list, generuje a udržuje loop
- `PROMPT_plan.md`, `PROMPT_build.md` — prompty pro jednotlivé režimy
- `CLAUDE.md` — příkazy a gotchas, Claude to čte v každé iteraci

## Spuštění

```bash
./loop.sh plan 1        # vytvoří IMPLEMENTATION_PLAN.md ze specs
./loop.sh build 5       # 5 iterací, každá = 1 položka + commit
./loop.sh build         # dokud nevypíše <ralph>DONE</ralph>
MODEL=sonnet ./loop.sh build 10   # levnější model
```

Mezi běhy projdi `git log` a plán. Když loop jde špatným směrem, oprav specy nebo plán (nebo smaž plán a pusť znovu `plan`), ne kód.

Loop běží s allowlistem nástrojů (soubory, npm/npx, git commit). Přes `npx` ale umí spustit cokoliv, takže je nejbezpečnější ho pouštět v kontejneru nebo VM.
