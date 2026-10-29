import { ChevronLeftIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { z } from "zod";
import { coachContextHref, Thread } from "@/app/app/messages/thread";
import { requireCoach, requireCoachOf } from "@/lib/auth";
import { db } from "@/lib/db";

// The coach's messages: every active client's thread, the latest first with its unread count, and the chosen one
// (`?client=`) beside it (on a phone: the list, or the thread with a way back).
export default async function CoachMessages({ searchParams }: PageProps<"/coach/messages">) {
  const coach = await requireCoach();
  const { client: chosen } = z.object({ client: z.string().optional().catch(undefined) }).parse(await searchParams);
  const [t, format, clients, unread] = await Promise.all([
    getTranslations("Messages"),
    getFormatter(),
    db.client.findMany({
      where: { coachId: coach.id, user: { active: true } },
      select: { id: true, user: { select: { name: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { text: true, createdAt: true, senderId: true } } },
    }),
    db.message.groupBy({ by: ["clientId"], where: { client: { coachId: coach.id }, senderId: { not: coach.id }, readAt: null }, _count: true }),
  ]);
  const threads = clients.toSorted((a, b) => (b.messages[0]?.createdAt.getTime() ?? 0) - (a.messages[0]?.createdAt.getTime() ?? 0) || a.user.name.localeCompare(b.user.name));
  const open = chosen ? (await requireCoachOf(chosen)).client : null;
  const name = open && clients.find((c) => c.id === open.id)?.user.name;

  return (
    <div className="flex flex-col gap-6">
      {/* On a phone an open thread is the whole page: a way back, and the client's name as its title. */}
      <header>
        {open && (
          <Link href="/coach/messages" className="-ml-1 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden">
            <ChevronLeftIcon className="size-4" aria-hidden />
            {t("title")}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight">
          {open ? (
            <>
              <span className="max-lg:hidden">{t("title")}</span>
              <span className="lg:hidden">{name}</span>
            </>
          ) : (
            t("title")
          )}
        </h1>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <nav aria-label={t("threads")} className={open ? "max-lg:hidden" : ""}>
          <ul className="rounded-lg border bg-card">
            {threads.map((c) => {
              const count = unread.find((u) => u.clientId === c.id)?._count ?? 0;
              const last = c.messages[0];
              return (
                <li key={c.id} className="border-b border-rule last:border-0">
                  <Link
                    href={`/coach/messages?client=${c.id}`}
                    aria-current={c.id === open?.id ? "page" : undefined}
                    className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-muted/60 aria-[current=page]:bg-primary-soft"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className={`truncate text-sm ${count ? "font-semibold" : "font-medium"}`}>{c.user.name}</span>
                      {count > 0 && <span className="flex-none rounded-full bg-primary px-2 text-xs leading-5 font-medium text-primary-foreground tabular-nums">{t("unread", { count })}</span>}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {last ? `${last.senderId === coach.id ? `${t("you")}: ` : ""}${last.text}` : t("noMessages")}
                      {last && ` · ${format.dateTime(last.createdAt, { day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" })}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {open ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold max-lg:hidden">
              <Link href={`/coach/clients/${open.id}`} className="hover:underline">
                {name}
              </Link>
            </h2>
            <Thread clientId={open.id} viewer={coach} contextHref={coachContextHref(open.id)} />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground max-lg:hidden">{t("choose")}</p>
        )}
      </div>
    </div>
  );
}
