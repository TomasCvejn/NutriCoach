import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import type { MessageContext } from "@/lib/enums";
import { deletableSince } from "@/lib/messages";
import { deleteMessage } from "./actions";
import { Composer, Poll } from "./composer";

// A client's thread with their coach, for either of them (the caller has authorized `viewer` for this client): the
// messages oldest first (the last 200), the composer, and a poll for new ones. Opening it marks the other one's messages read.
// `contextHref` leads a comment back to its day or check-in in the viewer's area.
export async function Thread({ clientId, viewer, contextHref }: { clientId: string; viewer: { id: string }; contextHref: (type: MessageContext, key: string) => string }) {
  await db.message.updateMany({ where: { clientId, senderId: { not: viewer.id }, readAt: null }, data: { readAt: new Date() } });
  const [t, format, latest] = await Promise.all([
    getTranslations("Messages"),
    getFormatter(),
    db.message.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 200, include: { sender: { select: { name: true } } } }),
  ]);
  const messages = latest.reverse();
  // Comments on check-ins name the check-in by its week.
  const checkIns = await db.checkIn.findMany({ where: { id: { in: messages.flatMap((m) => (m.contextType === "CHECK_IN" && m.contextKey ? [m.contextKey] : [])) } }, select: { id: true, dueDate: true } });
  const day = (date: string) => format.dateTime(new Date(date), { day: "numeric", month: "numeric", timeZone: "UTC" });
  const contextLabel = (type: MessageContext, key: string) =>
    t(`context.${type}`, { date: type === "NUTRITION_DAY" ? day(key) : day(checkIns.find((c) => c.id === key)?.dueDate ?? key) });
  // ponytail: the delete button shows for messages young enough at render time; the server checks again.
  const deletable = deletableSince();

  return (
    <section aria-label={t("thread")} className="flex flex-col gap-4">
      {messages.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol aria-label={t("list")} className="flex flex-col gap-3">
          {messages.map((message) => {
            const own = message.senderId === viewer.id;
            return (
              <li key={message.id} className={`flex flex-col gap-1 ${own ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-line ${own ? "bg-primary-soft" : "border bg-card"}`}>
                  {message.contextType && message.contextKey && (
                    <Link href={contextHref(message.contextType as MessageContext, message.contextKey)} className="mb-1 block text-xs font-medium text-primary-ink hover:underline">
                      {contextLabel(message.contextType as MessageContext, message.contextKey)}:
                    </Link>
                  )}
                  {message.text}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {own ? t("you") : message.sender.name} · {format.dateTime(message.createdAt, { day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                  {own && message.createdAt > deletable && (
                    <form action={deleteMessage}>
                      <input type="hidden" name="id" value={message.id} />
                      <Button type="submit" variant="ghost" className="h-8 px-2 text-xs" aria-label={t("deleteFrom", { time: format.dateTime(message.createdAt, { timeStyle: "short" }) })}>
                        {t("delete")}
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Composer clientId={clientId} />
      <Poll />
    </section>
  );
}

// Where a comment leads the coach: the client's day in the daily log, or the check-in review.
export const coachContextHref = (clientId: string) => (type: MessageContext, key: string) =>
  type === "NUTRITION_DAY" ? `/coach/clients/${clientId}/nutrition/log?date=${key}` : `/coach/check-ins/${key}`;
