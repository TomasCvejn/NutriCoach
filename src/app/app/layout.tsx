import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { clientFeatures } from "@/lib/features";
import { clientNav } from "@/lib/nav";
import { currentCheckIn, notifyCheckInDue } from "@/lib/check-ins";

export default async function ClientLayout({ children }: LayoutProps<"/app">) {
  const { user, client } = await requireClient();
  if (!client.onboardingCompletedAt) redirect("/onboarding");
  // ponytail: no competitions exist yet; their item feeds the real date in here.
  const session = await db.trainingSession.findFirst({ where: { clientId: client.id }, select: { id: true } });
  const features = clientFeatures({ hasSport: Boolean(client.sports), hasSession: Boolean(session), lastCompetitionDate: null }, todayIn(user.timezone));
  await notifyCheckInDue(user.id, await currentCheckIn(client, user.timezone)); // before the count, so the bell shows it
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return (
    <AppShell nav={clientNav(features)} user={{ name: user.name, email: user.email }} unread={unread}>
      {children}
    </AppShell>
  );
}
