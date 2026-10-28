import { AppShell } from "@/components/app-shell";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { clientFeatures } from "@/lib/features";
import { clientNav } from "@/lib/nav";

export default async function ClientLayout({ children }: LayoutProps<"/app">) {
  const { user } = await requireClient();
  // ponytail: no profile sport, sessions or competitions exist yet; their items feed the real data in here.
  const features = clientFeatures({ hasSport: false, hasSession: false, lastCompetitionDate: null }, todayIn(user.timezone));
  return (
    <AppShell nav={clientNav(features)} user={{ name: user.name, email: user.email }}>
      {children}
    </AppShell>
  );
}
