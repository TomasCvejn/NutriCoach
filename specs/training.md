# Training, fueling, hydration
Training and fueling: SPORTS and COMPETITION programs. Hydration: all programs.

## Training dashboard
- Week view (default) + list of upcoming sessions; today's sessions on client home.
- Session: date, start time, type (run, bike, swim, strength, team practice, match, other + free-text sport), duration (min), intensity (low / moderate / high / very high), description. Client or coach creates/edits. "Repeat weekly until <date>" creates individual sessions (editing one doesn't touch the others).
- After the session (optional): RPE 1–10, "how it felt" 1–10, note → Performance in `progress.md`.
- Session detail shows its fueling plan and hydration ("nutrition linked to each session").

## Fueling plan
- Fueling templates (coach library): name, matching rule (session types — empty = any, min/max duration, min intensity), priority order, and phases:
  - Pre-training: list of {timing, e.g. "3–4 h before"; recommendation; optional carbs g}.
  - During: carbs g/h, fluid ml/h, sodium mg/h, recommendation text (e.g. "gel every 30 min").
  - Post-training: within N min, protein g, carbs g, fluid recommendation text.
- A session's fueling = coach override for that session, else the highest-priority matching template, else none. Pure function with tests.
- Session detail shows totals: carbs during = g/h × duration, fluid, sodium.
- Seeded editable templates (coach should review the numbers): "< 75 min" (during: water, 0 g/h); "75–150 min" (45 g/h, 500 ml/h, 400 mg/h); "> 150 min" and "very high intensity" (both 75 g/h, 600 ml/h, 600 mg/h; two templates because a matching rule is AND-only), these two with the highest priority.

## Hydration dashboard
- Daily fluid target = coach-set base (suggest 35 ml/kg) + on TRAINING/COMPETITION days the during-session fluid of that day's fueling plans.
- Logging: quick +250 / +500 ml, custom amount, drink type (water, electrolyte drink, sports drink, coffee/tea, other), optional sodium mg and carbs g. "My drinks" presets (client-saved: name, ml, sodium, carbs).
- Progress ring, today's list (edit / delete).
- Electrolytes (SPORTS/COMPETITION): sodium from today's drinks vs. the day's during-session sodium total.
- Training-specific hydration: today's sessions with their fluid and sodium recommendations.
