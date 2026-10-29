// Categorical values: one const array per field gives Zod validation, UI options and i18n keys.
export const ROLES = ["COACH", "CLIENT"] as const;
export const TRACKING_MODES = ["CALORIES", "PORTIONS", "GUIDANCE"] as const;
export const DAY_TYPES = ["REST", "TRAINING", "COMPETITION"] as const;
// Client: new message … competition phase started. Coach: new message, onboarding completed … client deleted their account.
export const NOTIFICATION_TYPES = [
  "NEW_MESSAGE",
  "CHECK_IN_DUE",
  "FEEDBACK_PUBLISHED",
  "PLAN_UPDATED",
  "CALL_SCHEDULED",
  "COMPETITION_PHASE_STARTED",
  "ONBOARDING_COMPLETED",
  "CHECK_IN_SUBMITTED",
  "CLIENT_DELETED_ACCOUNT",
] as const;

// Client profile (onboarding-profile.md). Allergens and diet types also drive recipe warnings (recipes.md).
export const SEXES = ["MALE", "FEMALE"] as const;
export const GOALS = ["LOSE_FAT", "MAINTAIN", "GAIN_MUSCLE", "PERFORMANCE", "HEALTH_ENERGY", "COMPETITION_PREP"] as const;
export const DIET_TYPES = ["OMNIVORE", "PESCATARIAN", "VEGETARIAN", "VEGAN", "OTHER"] as const;
// The 14 allergens EU law requires food labels to declare (Regulation 1169/2011, Annex II).
export const ALLERGENS = [
  "GLUTEN",
  "CRUSTACEANS",
  "EGGS",
  "FISH",
  "PEANUTS",
  "SOY",
  "MILK",
  "NUTS",
  "CELERY",
  "MUSTARD",
  "SESAME",
  "SULPHITES",
  "LUPIN",
  "MOLLUSCS",
] as const;
export const SPORT_LEVELS = ["RECREATIONAL", "AMATEUR_COMPETITIVE", "ELITE"] as const;
export const NOTE_TYPES = ["NOTE", "DECISION"] as const;
export const FOOD_SOURCES = ["OFF", "COACH", "CLIENT"] as const;
// The weekly check-in's 1–10 scales (check-ins.md), in the form's order.
export const CHECK_IN_SCALES = ["energy", "hunger", "recovery", "digestion", "training", "adherence", "mood"] as const;
export const CHECK_IN_STATUSES = ["ok", "due", "overdue", "toReview"] as const;
export const FEEDBACK_FIELDS = ["response", "changes", "newGoals", "nextSteps"] as const;
// Training (training.md). Intensities in order: fueling templates match a minimum intensity.
export const SESSION_TYPES = ["RUN", "BIKE", "SWIM", "STRENGTH", "TEAM_PRACTICE", "MATCH", "OTHER"] as const;
export const INTENSITIES = ["LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;
// Competitions (competition.md): the phases in order, "BASE" before the first one (no tasks).
export const COMPETITION_PRIORITIES = ["A", "B", "C"] as const;
export const PHASES = ["BASE", "4_WEEKS", "2_WEEKS", "RACE_WEEK", "DAY_BEFORE", "RACE_DAY"] as const;
export const TIMELINE_PHASES = ["4_WEEKS", "2_WEEKS", "RACE_WEEK", "DAY_BEFORE", "RACE_DAY"] as const; // the ones with priorities and tasks
export const PACKING_GROUPS = ["FOOD", "HYDRATION", "SUPPLEMENTS", "OTHER"] as const;
export const SCHEDULE_TYPES = ["EVENT", "MEAL", "SNACK", "CARBS", "HYDRATION", "RECOVERY", "SUPPLEMENT", "OTHER"] as const;
export const MESSAGE_CONTEXTS = ["NUTRITION_DAY", "CHECK_IN"] as const;
export const SUPPLEMENT_CATEGORIES = ["DAILY", "TRAINING", "COMPETITION"] as const;
export const BODY_COMP_METHODS = ["SCALE", "BIOIMPEDANCE", "DEXA", "SKINFOLDS", "TAPE"] as const;
export const BODY_FIELDS = ["weightKg", "bodyFatPct", "leanMassKg", "waistCm", "hipsCm", "chestCm", "thighCm", "armCm"] as const;
export const DRINK_TYPES = ["WATER", "ELECTROLYTE", "SPORTS", "COFFEE_TEA", "OTHER"] as const;
// Recipes (recipes.md): fixed categories, diet flags, statuses.
export const RECIPE_CATEGORIES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK", "PRE_TRAINING", "POST_TRAINING", "COMPETITION", "DESSERT"] as const;
export const DIET_FLAGS = ["VEGETARIAN", "VEGAN", "GLUTEN_FREE", "LACTOSE_FREE"] as const;
export const RECIPE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
// The only micronutrients tracked (per 100 g on foods, of the amount on entries), with their unit. Nothing else: the
// app isn't a full calorie table (user decision 2026-10-28).
export const MICRONUTRIENTS = { fiber: "g", sodium: "mg" } as const;
// GUIDANCE: "Followed: yes / partly / no" per planned meal.
export const FOLLOWED = ["YES", "PARTLY", "NO"] as const;

// Client history rows (HistoryEvent.type, coach.md); the payload of each type below. Plan and target changes add theirs.
export const HISTORY_TYPES = ["TRACKING_MODE", "TARGETS", "PLAN"] as const;
export type HistoryPayloads = {
  TRACKING_MODE: { from: TrackingMode; to: TrackingMode };
  TARGETS: { effectiveFrom: string; dayTypes: DayType[] };
  // Meals of one day type, the recommendations, the specifics, or the whole plan copied from another client (name snapshot).
  PLAN: { change: "MEALS"; dayType: DayType } | { change: "RECOMMENDATIONS" | "SPECIFICS" } | { change: "COPY"; source: string };
};

// Onboarding steps in order; Client.onboardingStep is the index.
export const ONBOARDING_STEPS = ["welcome", "about", "goal", "done"] as const;

export type Role = (typeof ROLES)[number];
export type TrackingMode = (typeof TRACKING_MODES)[number];
export type DayType = (typeof DAY_TYPES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type Allergen = (typeof ALLERGENS)[number];
export type Goal = (typeof GOALS)[number];
export type NoteType = (typeof NOTE_TYPES)[number];
export type Followed = (typeof FOLLOWED)[number];
export type DrinkType = (typeof DRINK_TYPES)[number];
export type CheckInScale = (typeof CHECK_IN_SCALES)[number];
export type CheckInStatus = (typeof CHECK_IN_STATUSES)[number];
export type SessionType = (typeof SESSION_TYPES)[number];
export type Intensity = (typeof INTENSITIES)[number];
export type Phase = (typeof PHASES)[number];
export type TimelinePhase = (typeof TIMELINE_PHASES)[number];
export type PackingGroup = (typeof PACKING_GROUPS)[number];
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];
export type MessageContext = (typeof MESSAGE_CONTEXTS)[number];
export type SupplementCategory = (typeof SUPPLEMENT_CATEGORIES)[number];
export type BodyCompMethod = (typeof BODY_COMP_METHODS)[number];
export type BodyField = (typeof BODY_FIELDS)[number];
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
export type DietFlag = (typeof DIET_FLAGS)[number];
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];
export type HistoryType = (typeof HISTORY_TYPES)[number];
export type DietType = (typeof DIET_TYPES)[number];
export type Sex = (typeof SEXES)[number];
export type SportLevel = (typeof SPORT_LEVELS)[number];
