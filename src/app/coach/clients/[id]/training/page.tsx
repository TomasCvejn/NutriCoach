import { TrainingWeek, weekParam } from "@/app/app/training/training-week";
import { requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";

// Training tab: the client's week of sessions and the upcoming ones; the coach adds and edits too.
export default async function ClientTrainingTab({ params, searchParams }: PageProps<"/coach/clients/[id]/training">) {
  const { client } = await requireCoachOf((await params).id);
  const { week } = weekParam.parse(await searchParams);
  const user = await db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } });
  return (
    <div className="max-w-3xl">
      <TrainingWeek clientId={client.id} timezone={user.timezone} week={week} base={`/coach/clients/${client.id}/training`} />
    </div>
  );
}
