import { notFound } from "next/navigation";
import { SessionDetail } from "@/app/app/training/session-detail";
import { requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";

// A client's session for the coach, who can also pick its fueling template.
export default async function CoachSession({ params }: PageProps<"/coach/clients/[id]/training/[sessionId]">) {
  const { id, sessionId } = await params;
  const { coach, client } = await requireCoachOf(id);
  const session = await db.trainingSession.findFirst({ where: { id: sessionId, clientId: client.id } });
  if (!session) notFound();
  return <SessionDetail session={session} coachId={coach.id} back={`/coach/clients/${client.id}/training`} override />;
}
