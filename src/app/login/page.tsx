import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LOCALES } from "@/i18n/locales";
import { devLoginEnabled, getSession, googleEnabled } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/enums";
import { devLogin, setLocaleCookie, signInWithGoogle } from "./actions";

// ?error= codes from the Google callback and the dev login action; anything else is a generic failure.
const ERRORS: Record<string, string> = { signup_disabled: "noAccount", ACCOUNT_INACTIVE: "inactive" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Only active sessions leave: requireUser sends inactive ones here, so redirecting them back would loop.
  if ((await getSession())?.user.active) redirect("/");
  const { error } = await searchParams;
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  // ponytail: every user, unpaged — dev data is a handful of rows.
  const devUsers = devLoginEnabled() ? await db.user.findMany({ orderBy: { name: "asc" } }) : [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 items-center justify-between gap-4 border-b px-4 sm:px-[29px]">
        <Logo />
        <form action={setLocaleCookie} aria-label={t("Language.label")} className="flex gap-1">
          {LOCALES.map((l) => (
            <button
              key={l}
              name="locale"
              value={l}
              aria-pressed={l === locale}
              className="h-8 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-primary-soft aria-pressed:font-medium aria-pressed:text-primary-ink"
            >
              {t(`Language.${l}`)}
            </button>
          ))}
        </form>
      </header>
      <main className="flex flex-1 justify-center px-4 pt-12 pb-16 sm:items-center sm:pb-28">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight sm:text-title">{t("Login.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("Login.tagline")}</p>
          <div className="mt-6 flex flex-col gap-4 rounded-lg border bg-card p-6">
            {typeof error === "string" && (
              <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-ink">
                {t(`Login.errors.${ERRORS[error] ?? "failed"}`)}
              </p>
            )}
            {googleEnabled ? (
              <form action={signInWithGoogle}>
                <Button type="submit" variant="outline" className="h-10 w-full gap-3 bg-card text-sm">
                  <GoogleMark />
                  {t("Login.google")}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">{t("Login.googleMissing")}</p>
            )}
            <p className="text-sm text-muted-foreground">{t("Login.inviteNote")}</p>
          </div>
          {devUsers.length > 0 && (
            <section aria-labelledby="dev-login" className="mt-8">
              <h2 id="dev-login" className="text-base font-semibold">
                {t("Login.dev.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("Login.dev.note")}</p>
              <form action={devLogin} className="mt-3 rounded-lg border bg-card py-1">
                {ROLES.map((role) => (
                  <div key={role}>
                    <h3 className="px-4 pt-3 pb-1 text-xs text-muted-foreground">{t(`Login.dev.${role}`)}</h3>
                    <ul>
                      {devUsers
                        .filter((u) => u.role === role)
                        .map((u) => (
                          <li key={u.id}>
                            <button
                              name="email"
                              value={u.email}
                              className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{u.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                              </span>
                              {!u.active && (
                                <span className="flex-none rounded-sm bg-destructive-soft px-1.5 py-0.5 text-xs font-medium text-destructive-ink">
                                  {t("Login.dev.inactive")}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </form>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

// Google's own "G" in its brand colours (their sign-in button guidelines).
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
