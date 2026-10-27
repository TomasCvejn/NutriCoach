# Nutrition plan & daily nutrition

## Nutrition plan (client screen; coach edits it in the Client Nutrition Plan Editor)
- **Daily targets** per day type (REST / TRAINING / COMPETITION; GENERAL program only REST):
  - CALORIES: kcal, protein, carbs, fat (g); optional fiber (g), sodium (mg). Show kcal computed from macros (4/4/9) and warn if > 5 % off. Show g/kg body weight next to each macro.
  - PORTIONS: protein palms, carb cupped hands, veg fists, fat thumbs per day.
  - GUIDANCE: no numeric targets.
  - Fluid target (ml/day) for all modes — see hydration in `training.md`.
  - Targets have an effective-from date; history is kept. Target for a date = latest with `effectiveFrom <= date`.
  - "Suggest" (CALORIES, REST): Mifflin-St Jeor BMR × activity factor (1.2 / 1.375 / 1.55 / 1.725), goal adjustment lose −20 % / gain muscle +10 % / else 0; protein 2 g/kg, fat 25 % of kcal, carbs the rest. "Copy to other day types" button. Pure functions with unit tests.
- **Meals**: ordered meal structure per day type (e.g. Breakfast, Snack, Lunch, Pre-training, Dinner): name, time hint, portion guidance text (PORTIONS: portion counts per meal), recipe options linked from the library, note.
- **Coach recommendations**: ordered list (title + text), e.g. "Protein in every meal".
- **Specifics for this client**: free text.
- Coach can "Copy plan from another client" (targets, meals, recommendations) and then edit. ponytail: no separate template system.
- Every plan change is recorded in client history (`coach.md`) and notifies the client "Your plan was updated".

## Daily nutrition (client), by tracking mode
Common: date navigation, day type badge (overridable), day note for the coach, coach comments on a day (`messaging.md`). Meal slots = meals of the plan for that day type (fallback: Breakfast, Lunch, Dinner, Snacks). Coach sees the same screen read-only.

### CALORIES
- Food database:
  - Open Food Facts (OFF): text search and barcode (EAN) lookup, always server-side through our own route handler, `User-Agent: NutriCoach/0.1`, 5 s timeout, prefer Czech products/names. A product used for the first time is upserted into the local `Food` table (source `OFF`, barcode, nutrients per 100 g).
  - Custom foods: by the coach (visible to all their clients) or by a client (visible to that client and coach). Name, brand, nutrients per 100 g, optional servings ("1 piece = 60 g").
  - Search merges: client's recent foods → custom foods → OFF. Debounced, phone-friendly.
  - Barcode: manual EAN input always; camera scan button only when `BarcodeDetector` exists.
  - OFF failure/timeout must not break search (recent + custom still shown, with a notice). Tests never hit the network — mock OFF.
- Add entry: food → grams or a serving → meal slot. Entry stores a **snapshot** of name and nutrients; changing a Food or recipe never changes past logs.
- Also: quick add (kcal + macros), add a recipe (portions → snapshot), edit amount, move to another meal, delete, copy a meal or whole day from another date.
- Totals per meal and per day; progress bars kcal/P/C/F vs. target, over-target shown distinctly.
- Micronutrients (collapsed section): fiber, sugar, saturated fat, sodium, potassium, calcium, iron, magnesium, vitamin C, vitamin D, vitamin B12 — totals of available data with a "data incomplete" hint when some entries lack a value.

### PORTIONS
- Per meal: +/− counters for protein palms, carb cupped hands, veg fists, fat thumbs (half steps allowed); short illustrated explanation of each portion.
- Day totals vs. portion targets. Optional meal photo.

### GUIDANCE
- Per planned meal: guidance + recipe options from the plan; "Followed: yes / partly / no", optional note and photo.

### Adherence (pure functions, unit-tested; used by dashboards and progress)
- CALORIES: ≥ 1 entry AND kcal within ±10 % of target AND protein ≥ 90 % of target.
- PORTIONS: every category within ±1 portion of target.
- GUIDANCE: (yes + 0.5 × partly) / planned meals ≥ 0.75.
- Nothing logged = not adherent and counts as "not logged".
