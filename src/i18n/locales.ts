export const LOCALES = ["cs", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "cs";
// Logged-out pages and new coaches; logged-in users get the timezone stored on the user.
export const DEFAULT_TIMEZONE = "Europe/Prague";
// Locale for logged-out pages; logged-in users get the locale stored on the user.
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}
