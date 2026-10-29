import { BodyComposition } from "@/app/app/progress/body-composition";
import { requireCoachOf } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";

// Progress tab: the client's body composition (the coach adds and edits too). The trends dashboard lands above it.
export default async function ClientProgressTab({ params }: PageProps<"/coach/clients/[id]/progress">) {
  const { client } = await requireCoachOf((await params).id);
  const user = await db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } });
  return <BodyComposition clientId={client.id} today={todayIn(user.timezone)} />;
}
