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

export type Role = (typeof ROLES)[number];
export type TrackingMode = (typeof TRACKING_MODES)[number];
export type DayType = (typeof DAY_TYPES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
