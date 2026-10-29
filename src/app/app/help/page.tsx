import { requireClient } from "@/lib/auth";
import { HelpPage } from "./help-page";

export default async function ClientHelp() {
  await requireClient();
  return <HelpPage role="CLIENT" />;
}
