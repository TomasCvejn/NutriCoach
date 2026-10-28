import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";
import { coachNav } from "@/lib/nav";

export default async function CoachLayout({ children }: LayoutProps<"/coach">) {
  const coach = await requireCoach();
  const unread = await db.notification.count({ where: { userId: coach.id, readAt: null } });
  return (
    <AppShell nav={coachNav} user={{ name: coach.name, email: coach.email }} unread={unread}>
      {children}
    </AppShell>
  );
}
