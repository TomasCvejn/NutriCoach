import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { GoogleMark, PublicHeader } from "@/components/public-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_TIMEZONE, TIMEZONES } from "@/i18n/locales";
import { devLoginEnabled, googleEnabled } from "@/lib/auth";
import { db } from "@/lib/db";
import { acceptWithGoogle, devAcceptInvite } from "./actions";
import { TimezoneSelect } from "./timezone-select";

// ?error= codes from acceptInvite (via the Google hook or dev accept); anything else (e.g. Google's access_denied) is generic.
const ERRORS: Record<string, string> = { email_mismatch: "emailMismatch", email_taken: "emailTaken" };

// Logged out on purpose: the token is the credential. Shows only the coach's name.
export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const [{ token }, { error }, t] = await Promise.all([params, searchParams, getTranslations()]);
  const invite = await db.invite.findUnique({ where: { token }, include: { coach: { select: { name: true } } } });
  const status = !invite ? "unknown" : invite.usedAt ? "used" : invite.revokedAt ? "revoked" : invite.expiresAt <= new Date() ? "expired" : "pending";

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      <main className="flex flex-1 justify-center px-4 pt-12 pb-16 sm:items-center sm:pb-28">
        <div className="w-full max-w-sm">
          {status !== "pending" || !invite ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight sm:text-title">{t(`Invite.status.${status}.title`)}</h1>
              <p className="mt-2 text-muted-foreground">{t(`Invite.status.${status}.text`)}</p>
              {status === "used" && (
                <Link href="/login" className={buttonVariants({ className: "mt-6 h-10 px-4" })}>
                  {t("Invite.signIn")}
                </Link>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight sm:text-title">{t("Invite.title", { coach: invite.coach.name })}</h1>
              <p className="mt-2 text-muted-foreground">{t("Invite.lead")}</p>
              <form className="mt-6 flex flex-col gap-8">
                <input type="hidden" name="token" value={token} />
                <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
                  {typeof error === "string" && (
                    <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-ink">
                      {t(`Invite.errors.${ERRORS[error] ?? "failed"}`)}
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="timezone">{t("Invite.timezone")}</Label>
                    <TimezoneSelect id="timezone" name="timezone" aria-describedby="timezone-hint" zones={TIMEZONES} fallback={DEFAULT_TIMEZONE} />
                    <p id="timezone-hint" className="text-xs text-muted-foreground">
                      {t("Invite.timezoneHint")}
                    </p>
                  </div>
                  {googleEnabled ? (
                    <Button type="submit" formAction={acceptWithGoogle} variant="outline" className="h-10 w-full gap-3 bg-card text-sm">
                      <GoogleMark />
                      {t("Login.google")}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("Login.googleMissing")}</p>
                  )}
                </div>
                {devLoginEnabled() && (
                  <section aria-labelledby="dev-accept">
                    <h2 id="dev-accept" className="text-base font-semibold">
                      {t("Login.dev.title")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t("Invite.dev.note")}</p>
                    <div className="mt-3 flex flex-col gap-3 rounded-lg border bg-card p-4">
                      <Label htmlFor="email">{t("Invite.dev.email")}</Label>
                      <Input id="email" name="email" type="email" defaultValue={invite.email ?? ""} />
                      <Button type="submit" formAction={devAcceptInvite} variant="outline">
                        {t("Invite.dev.submit")}
                      </Button>
                    </div>
                  </section>
                )}
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
