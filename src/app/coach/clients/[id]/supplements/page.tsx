import { SupplementList } from "@/app/app/supplements/supplement-list";
import { requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";

// Supplements tab: what the client takes; the coach assigns and edits, and sees the ones the client added.
export default async function ClientSupplementsTab({ params }: PageProps<"/coach/clients/[id]/supplements">) {
  const { client } = await requireCoachOf((await params).id);
  const user = await db.user.findUniqueOrThrow({ where: { id: client.userId }, select: { timezone: true } });
  return (
    <div className="max-w-3xl">
      <SupplementList clientId={client.id} timezone={user.timezone} viewer="coach" />
    </div>
  );
}
