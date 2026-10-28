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

// Client history rows (HistoryEvent.type, coach.md); the payload of each type below. Plan and target changes add theirs.
export const HISTORY_TYPES = ["TRACKING_MODE"] as const;
export type HistoryPayloads = { TRACKING_MODE: { from: TrackingMode; to: TrackingMode } };

// Onboarding steps in order; Client.onboardingStep is the index.
export const ONBOARDING_STEPS = ["welcome", "about", "goal", "done"] as const;

export type Role = (typeof ROLES)[number];
export type TrackingMode = (typeof TRACKING_MODES)[number];
export type DayType = (typeof DAY_TYPES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type Allergen = (typeof ALLERGENS)[number];
export type Goal = (typeof GOALS)[number];
export type NoteType = (typeof NOTE_TYPES)[number];
export type HistoryType = (typeof HISTORY_TYPES)[number];
export type DietType = (typeof DIET_TYPES)[number];
export type Sex = (typeof SEXES)[number];
export type SportLevel = (typeof SPORT_LEVELS)[number];
