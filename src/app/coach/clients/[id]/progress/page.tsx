import { BodyComposition } from "@/app/app/progress/body-composition";
import { ProgressDashboard, rangeParam } from "@/app/app/progress/dashboard";
import { requireCoachOf } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";

// Progress tab: the client's trends over the chosen range, then body composition (the coach adds and edits too).
export default async function ClientProgressTab({ params, searchParams }: PageProps<"/coach/clients/[id]/progress">) {
  const { client } = await requireCoachOf((await params).id);
  const { range } = rangeParam.parse(await searchParams);
  const user = await db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } });
  return (
    <div className="flex flex-col gap-6">
      <ProgressDashboard client={client} timezone={user.timezone} weeks={range} base={`/coach/clients/${client.id}/progress`} />
      <BodyComposition clientId={client.id} today={todayIn(user.timezone)} />
    </div>
  );
}
