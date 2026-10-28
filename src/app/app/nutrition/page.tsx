import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { DailyLog } from "./daily-log";

const params = z.object({ date: z.iso.date().optional().catch(undefined) });

// The client's Nutrition tab: one day at a time, today unless ?date= says otherwise.
export default async function ClientNutrition({ searchParams }: PageProps<"/app/nutrition">) {
  const { user, client } = await requireClient();
  const t = await getTranslations("DailyNutrition");
  const date = params.parse(await searchParams).date ?? todayIn(user.timezone);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <DailyLog clientId={client.id} date={date} viewer="CLIENT" href={(d) => `/app/nutrition?date=${d}`} />
    </div>
  );
}
