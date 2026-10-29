import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { featuresOf } from "@/lib/features";
import { clientNav } from "@/lib/nav";
import { currentCheckIn, notifyCheckInDue } from "@/lib/check-ins";

export default async function ClientLayout({ children }: LayoutProps<"/app">) {
  const { user, client } = await requireClient();
  if (!client.onboardingCompletedAt) redirect("/onboarding");
  const features = await featuresOf(client, todayIn(user.timezone));
  await notifyCheckInDue(user.id, await currentCheckIn(client, user.timezone)); // before the count, so the bell shows it
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return (
    <AppShell nav={clientNav(features)} user={{ name: user.name, email: user.email }} unread={unread}>
      {children}
    </AppShell>
  );
}
