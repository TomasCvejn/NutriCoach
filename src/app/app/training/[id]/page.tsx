import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { SessionDetail } from "../session-detail";

export default async function ClientSession({ params }: PageProps<"/app/training/[id]">) {
  const { client } = await requireClient();
  const session = await db.trainingSession.findFirst({ where: { id: (await params).id, clientId: client.id } });
  if (!session) notFound();
  return <SessionDetail session={session} coachId={client.coachId} back="/app/training" override={false} />;
}
