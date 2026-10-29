import { getFormatter, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { MessageContext } from "@/lib/enums";
import { Composer } from "./composer";

// The comments on one nutrition day or check-in (messaging.md "context comments"), for the client or their coach (the
// caller has authorized the viewer for this client): the messages with that context, oldest first, and a box to add one.
// They are messages of the thread too; seeing them here marks the other side's ones read.
export async function ContextComments({ clientId, type, contextKey }: { clientId: string; type: MessageContext; contextKey: string }) {
  const viewer = await requireUser();
  const where = { clientId, contextType: type, contextKey };
  await db.message.updateMany({ where: { ...where, senderId: { not: viewer.id }, readAt: null }, data: { readAt: new Date() } });
  const [t, format, comments] = await Promise.all([
    getTranslations("Messages"),
    getFormatter(),
    db.message.findMany({ where, orderBy: { createdAt: "asc" }, include: { sender: { select: { name: true } } } }),
  ]);
  return (
    <section aria-labelledby={`comments-${contextKey}`} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <h2 id={`comments-${contextKey}`} className="text-base font-semibold">
        {t("comments")}
      </h2>
      {comments.length > 0 && (
        <ul className="flex flex-col">
          {comments.map((comment) => (
            <li key={comment.id} className="border-t border-rule py-2.5 text-sm first:border-0">
              <p className="text-xs text-muted-foreground">
                {comment.senderId === viewer.id ? t("you") : comment.sender.name} · {format.dateTime(comment.createdAt, { day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="mt-0.5 whitespace-pre-line">{comment.text}</p>
            </li>
          ))}
        </ul>
      )}
      <Composer clientId={clientId} context={{ type, key: contextKey }} />
    </section>
  );
}
