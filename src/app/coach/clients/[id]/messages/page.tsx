import { Thread } from "@/app/app/messages/thread";
import { requireCoachOf } from "@/lib/auth";

// Messages tab: the thread with this client.
export default async function ClientMessagesTab({ params }: PageProps<"/coach/clients/[id]/messages">) {
  const { coach, client } = await requireCoachOf((await params).id);
  return (
    <div className="max-w-3xl">
      <Thread clientId={client.id} viewer={coach} />
    </div>
  );
}
