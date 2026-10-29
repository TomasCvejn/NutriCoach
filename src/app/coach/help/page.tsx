import { HelpPage } from "@/app/app/help/help-page";
import { requireCoach } from "@/lib/auth";

export default async function CoachHelp() {
  await requireCoach();
  return <HelpPage role="COACH" />;
}
