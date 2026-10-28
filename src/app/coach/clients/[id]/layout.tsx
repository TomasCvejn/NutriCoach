import { ChevronLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Pill } from "@/components/pill";
import { requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Goal, TrackingMode } from "@/lib/enums";
import { ClientTabs, TrackingModeDialog } from "./client-header";

// One client for their coach: the header (who, mode, goal; actions) and the tabs over every tab's page.
export default async function ClientLayout({ params, children }: LayoutProps<"/coach/clients/[id]">) {
  const { client } = await requireCoachOf((await params).id);
  const [t, user] = await Promise.all([getTranslations(), db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { name: true, active: true } })]);
  const mode = client.trackingMode as TrackingMode;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href="/coach/clients" className="-ml-1 inline-flex h-8 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-4" aria-hidden />
            {t("Nav.clients")}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
            {!user.active ? <Pill>{t("Clients.statuses.INACTIVE")}</Pill> : !client.onboardingCompletedAt && <Pill tone="accent">{t("Clients.statuses.ONBOARDING")}</Pill>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("ClientDashboard.mode", { mode: t(`TrackingModes.${mode}`) })} · {client.primaryGoal ? t(`Goals.${client.primaryGoal as Goal}`) : t("ClientDashboard.noGoal")}
          </p>
        </div>
        <TrackingModeDialog clientId={client.id} name={user.name} mode={mode} />
      </header>
      <ClientTabs clientId={client.id} />
      {children}
    </div>
  );
}
