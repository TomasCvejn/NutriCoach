import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { getFormatter, getNow, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { markAllRead, markRead, openNotification } from "./actions";

// The signed-in user's notifications, newest first. Also the coach's page (/coach/notifications re-exports it);
// the area layout has already checked the role, and every query is scoped to the user.
export default async function NotificationsPage() {
  const user = await requireUser();
  const [t, format, now, notifications, unread] = await Promise.all([
    getTranslations("Notifications"),
    getFormatter(),
    getNow(),
    // ponytail: the newest 50 only; add "load more" when someone needs older ones.
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  // Each type's text values, formatted for the viewer.
  const values = ({ type, payload }: (typeof notifications)[number]) => {
    const p = payload as Record<string, string>;
    // A calendar day: formatted at UTC midnight so no timezone can move it.
    if (type === "CHECK_IN_DUE") return { date: format.dateTime(new Date(p.dueDate), { dateStyle: "medium", timeZone: "UTC" }) };
    if (type === "CALL_SCHEDULED") return { time: format.dateTime(new Date(p.startsAt), { dateStyle: "medium", timeStyle: "short" }) };
    return p;
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          {notifications.length > 0 && <p className="mt-1 text-sm text-muted-foreground">{t("summary", { count: unread })}</p>}
        </div>
        {unread > 0 && (
          <form action={markAllRead}>
            <Button type="submit" variant="outline" className="h-10 sm:h-8">
              {t("markAllRead")}
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul>
          {notifications.map((n) => (
            // Columns: unread dot · text and time (opens the target) · "mark read" in a fixed slot so every row lines up.
            <li key={n.id} className="flex items-center gap-3 border-b border-rule">
              {/* On the first text line: py-3 + half the 20px line − half the dot. */}
              <span aria-hidden className={cn("mt-[18px] size-2 flex-none self-start rounded-full", !n.readAt && "bg-primary")} />
              <form action={openNotification} className="min-w-0 flex-1">
                <input type="hidden" name="id" value={n.id} />
                <button
                  type="submit"
                  className="group flex min-h-14 w-full flex-col items-start justify-center gap-0.5 py-3 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <span className={cn("group-hover:underline", n.readAt ? "text-muted-foreground" : "font-medium")}>
                    {!n.readAt && <span className="sr-only">{t("unread")}: </span>}
                    {t(`types.${n.type}`, values(n))}
                  </span>
                  <time
                    dateTime={n.createdAt.toISOString()}
                    title={format.dateTime(n.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                    className="flex-none text-xs text-muted-foreground tabular-nums"
                  >
                    {format.relativeTime(n.createdAt, now)}
                  </time>
                </button>
              </form>
              <div className="flex w-11 flex-none justify-end sm:w-8">
                {!n.readAt && (
                  <form action={markRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <Button type="submit" variant="ghost" aria-label={t("markRead")} title={t("markRead")} className="size-11 sm:size-8">
                      <CheckIcon aria-hidden />
                    </Button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
