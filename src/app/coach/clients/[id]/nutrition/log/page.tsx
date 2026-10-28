import { z } from "zod";
import { DailyLog } from "@/app/app/nutrition/daily-log";
import { requireCoachOf } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";

const params = z.object({ date: z.iso.date().optional().catch(undefined) });

// The client's daily log for the coach: the client's own day screen, read-only except the day type.
export default async function ClientDailyLog({ params: route, searchParams }: PageProps<"/coach/clients/[id]/nutrition/log">) {
  const { client } = await requireCoachOf((await route).id);
  const { timezone } = await db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } });
  const date = params.parse(await searchParams).date ?? todayIn(timezone);
  return (
    <DailyLog clientId={client.id} date={date} viewer="COACH" href={(d) => `/coach/clients/${client.id}/nutrition/log?date=${d}`} />
  );
}
