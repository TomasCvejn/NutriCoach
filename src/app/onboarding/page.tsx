import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { Onboarding } from "./onboarding";

// The client's first screens after accepting the invite, outside the app shell: /app sends the client here until the last
// step is done. The step comes from the database, so a reload resumes where they were.
export default async function OnboardingPage() {
  const { user, client } = await requireClient();
  if (client.onboardingCompletedAt) redirect("/app");
  const [t, coach, invite] = await Promise.all([
    getTranslations(),
    db.user.findUniqueOrThrow({ where: { id: client.coachId }, select: { name: true, welcomeText: true } }),
    db.invite.findUnique({ where: { clientId: client.id }, select: { trackingMode: true } }),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 items-center justify-between gap-4 border-b px-4 sm:px-[29px]">
        <Logo />
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="h-10 px-3 text-muted-foreground sm:h-8">
            {t("Shell.logout")}
          </Button>
        </form>
      </header>
      <main className="flex flex-1 justify-center px-4 pt-8 pb-16 sm:px-[29px] sm:pt-12">
        {/* Keyed by step: each step starts with a fresh form state. */}
        <Onboarding
          key={client.onboardingStep}
          step={client.onboardingStep}
          profile={{ ...client, name: user.name }}
          coach={{ name: coach.name, welcome: coach.welcomeText ?? t("Onboarding.welcome.defaultText") }}
          inviteMode={invite?.trackingMode ?? null}
        />
      </main>
    </div>
  );
}
