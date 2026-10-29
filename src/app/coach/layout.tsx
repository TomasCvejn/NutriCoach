import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";
import { badgesOf } from "@/lib/messages";
import { coachNav } from "@/lib/nav";

export default async function CoachLayout({ children }: LayoutProps<"/coach">) {
  const coach = await requireCoach();
  return (
    <AppShell nav={coachNav} user={{ name: coach.name, email: coach.email }} badges={await badgesOf(coach)}>
      {children}
    </AppShell>
  );
}
