import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleMark, PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { devLoginEnabled, getSession, googleEnabled } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/enums";
import { devLogin, signInWithGoogle } from "./actions";

// ?error= codes from the Google callback and the dev login action; anything else is a generic failure.
const ERRORS: Record<string, string> = { signup_disabled: "noAccount", ACCOUNT_INACTIVE: "inactive" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Only active sessions leave: requireUser sends inactive ones here, so redirecting them back would loop.
  if ((await getSession())?.user.active) redirect("/");
  const { error } = await searchParams;
  const t = await getTranslations();
  // ponytail: every user, unpaged — dev data is a handful of rows.
  const devUsers = devLoginEnabled() ? await db.user.findMany({ orderBy: { name: "asc" } }) : [];

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
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
      <footer className="px-4 pb-8 text-center text-sm text-muted-foreground">
        <Link href="/privacy" className="hover:text-foreground hover:underline">
          {t("Privacy.link")}
        </Link>
      </footer>
    </div>
  );
}
