import { CompetitionList } from "@/app/app/competition/competition-list";
import { requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";

// Competition tab: the client's competitions; the coach adds, edits and records results.
export default async function ClientCompetitionTab({ params }: PageProps<"/coach/clients/[id]/competition">) {
  const { client } = await requireCoachOf((await params).id);
  const user = await db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } });
  return (
    <div className="max-w-3xl">
      <CompetitionList clientId={client.id} timezone={user.timezone} coach />
    </div>
  );
}
