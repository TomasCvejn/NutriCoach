import { getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/auth";
import { CalendarView, calendarParams } from "./calendar-view";

// The client's calendar (More → Calendar): their sessions, competitions, calls and check-in days.
export default async function ClientCalendar({ searchParams }: PageProps<"/app/calendar">) {
  const { user, client } = await requireClient();
  const { view, date } = calendarParams.parse(await searchParams);
  const t = await getTranslations("Calendar");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <CalendarView clients={[{ ...client, user, name: user.name }]} timezone={user.timezone} view={view} date={date} base="/app/calendar" coach={false} />
    </div>
  );
}
