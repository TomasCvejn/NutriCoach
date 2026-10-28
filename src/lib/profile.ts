import { z } from "zod";
import { todayIn } from "./dates";
import { ALLERGENS, DIET_TYPES, GOALS, SEXES, SPORT_LEVELS } from "./enums";
import { optional } from "./forms";

const text = (max: number) => optional(z.string().trim().max(max));
const int = (min: number, max: number) => optional(z.coerce.number().int().min(min).max(max));
const kg = optional(z.coerce.number().min(30).max(300));

// The client profile in the sections of onboarding-profile.md, one shared schema: the profile page saves one section
// at a time and onboarding asks the same sections as its steps. Input = the form's fields (see profileInput).
export const PROFILE_SECTIONS = {
  personal: z.object({
    name: z.string().trim().min(1).max(100),
    sex: optional(z.enum(SEXES)),
    // Kiritimati (UTC+14) reaches each date first, so a birth date that is already past anywhere is never refused.
    birthDate: optional(z.iso.date().refine((d) => d >= "1900-01-01" && d <= todayIn("Pacific/Kiritimati"))),
    heightCm: int(100, 250),
    weightKg: kg,
    phone: optional(z.string().trim().regex(/^\+?[\d ()-]{6,20}$/)),
  }),
  goals: z.object({ primaryGoal: optional(z.enum(GOALS)), targetWeightKg: kg, targetDate: optional(z.iso.date()), successText: text(1000) }),
  preferences: z.object({ likedFoods: text(1000), dislikedFoods: text(1000), mealsPerDay: int(1, 10) }),
  dietary: z.object({
    dietType: optional(z.enum(DIET_TYPES)),
    // The ticked checkboxes, kept in ALLERGENS order (which also drops repeats).
    allergens: z.array(z.enum(ALLERGENS)).transform((ticked) => ALLERGENS.filter((a) => ticked.includes(a))),
    allergiesNote: text(500),
    restrictions: text(1000),
  }),
  // A sport turns the Training section on (clientFeatures).
  training: z.object({ sports: text(200), sportLevel: optional(z.enum(SPORT_LEVELS)), sessionsPerWeek: int(0, 21), sessionMinutes: int(10, 600) }),
  additional: z.object({ healthConditions: text(1000), medications: text(1000), otherInfo: text(1000) }),
};

export type ProfileSection = keyof typeof PROFILE_SECTIONS;
export type ProfileField = { [S in ProfileSection]: keyof z.output<(typeof PROFILE_SECTIONS)[S]> }[ProfileSection];
export const PROFILE_SECTION_KEYS = Object.keys(PROFILE_SECTIONS) as [ProfileSection, ...ProfileSection[]];

// FormData → the object the schemas read: allergens are repeated checkbox fields.
export const profileInput = (form: FormData): Record<string, unknown> => ({ ...Object.fromEntries(form), allergens: form.getAll("allergens") });

// A refused save names the invalid fields and returns what was sent, so the form shows it again instead of resetting.
export type Refused = { invalid: string[]; values: Record<string, unknown> };
export const refused = (error: z.ZodError, values: Record<string, unknown>): Refused => ({ invalid: error.issues.map((issue) => String(issue.path[0])), values });
