import { AppShell } from "@/components/app-shell";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { clientFeatures } from "@/lib/features";
import { clientNav } from "@/lib/nav";

export default async function ClientLayout({ children }: LayoutProps<"/app">) {
  const { user, client } = await requireClient();
  // ponytail: no sessions or competitions exist yet; their items feed the real data in here.
  const features = clientFeatures({ hasSport: Boolean(client.sports), hasSession: false, lastCompetitionDate: null }, todayIn(user.timezone));
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return (
    <AppShell nav={clientNav(features)} user={{ name: user.name, email: user.email }} unread={unread}>
      {children}
    </AppShell>
  );
}
