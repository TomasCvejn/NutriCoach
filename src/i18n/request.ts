import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, isLocale, LOCALE_COOKIE } from "./locales";
import { messagesOf } from "./messages";

// Locale: user > cookie (logged-out pages) > cs. Time zone is always set, so formatting never falls back to server UTC.
export default getRequestConfig(async () => {
  const user = (await getSession())?.user;
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(user?.locale) ? user.locale : isLocale(cookie) ? cookie : DEFAULT_LOCALE;
  return {
    locale,
    timeZone: user?.timezone ?? DEFAULT_TIMEZONE,
    messages: await messagesOf(locale),
  };
});
