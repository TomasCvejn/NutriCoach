import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, isLocale } from "./locales";

// The messages of a locale; and a translator for code outside a request's next-intl setup (server actions writing text
// in the user's language, e.g. "X (copy)").
export const messagesOf = async (locale: string) => (await import(`../../messages/${isLocale(locale) ? locale : DEFAULT_LOCALE}.json`)).default;
export const translatorFor = async (locale: string) => createTranslator({ locale: isLocale(locale) ? locale : DEFAULT_LOCALE, messages: await messagesOf(locale) });
