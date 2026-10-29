import { getTranslations } from "next-intl/server";
import { CalendarView, calendarParams } from "@/app/app/calendar/calendar-view";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";

// The coach's calendar: every active client's sessions, competitions, calls and check-in days, or one client's.
export default async function CoachCalendar({ searchParams }: PageProps<"/coach/calendar">) {
  const coach = await requireCoach();
  const { view, date, client } = calendarParams.parse(await searchParams);
  const [t, clients] = await Promise.all([
    getTranslations("Calendar"),
    db.client.findMany({
      where: { coachId: coach.id, user: { active: true } },
      select: { id: true, checkInWeekday: true, onboardingCompletedAt: true, user: { select: { name: true, timezone: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  const shown = clients.filter((c) => !client || c.id === client).map((c) => ({ ...c, name: c.user.name }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <form action="/coach/calendar" className="flex items-end gap-2">
          <input type="hidden" name="view" value={view} />
          {date && <input type="hidden" name="date" value={date} />}
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("client")}
            <NativeSelect name="client" defaultValue={client ?? ""} className="[&_select]:h-10 sm:[&_select]:h-8">
              <NativeSelectOption value="">{t("allClients")}</NativeSelectOption>
              {clients.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.user.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <Button type="submit" variant="outline" className="h-10 sm:h-8">
            {t("filter")}
          </Button>
        </form>
      </div>
      <CalendarView clients={shown} timezone={coach.timezone} view={view} date={date} base="/coach/calendar" keep={client ? { client } : {}} coach />
    </div>
  );
}
