// Categorical values: one const array per field gives Zod validation, UI options and i18n keys.
export const ROLES = ["COACH", "CLIENT"] as const;
export const TRACKING_MODES = ["CALORIES", "PORTIONS", "GUIDANCE"] as const;
export const DAY_TYPES = ["REST", "TRAINING", "COMPETITION"] as const;

export type Role = (typeof ROLES)[number];
export type TrackingMode = (typeof TRACKING_MODES)[number];
export type DayType = (typeof DAY_TYPES)[number];
