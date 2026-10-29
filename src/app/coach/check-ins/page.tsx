import { ChevronRightIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Pill } from "@/components/pill";
import { requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";

// The coach's review queue: submitted check-ins of active clients waiting for feedback, oldest period first.
export default async function CheckInQueue() {
  const coach = await requireCoach();
  const [t, format, queue] = await Promise.all([
    getTranslations("CheckInReview"),
    getFormatter(),
    db.checkIn.findMany({
      where: { reviewedAt: null, client: { coachId: coach.id, user: { active: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, dueDate: true, createdAt: true, questions: true, client: { select: { user: { select: { name: true } } } } },
    }),
  ]);
  const day = (date: string) => format.dateTime(new Date(date), { day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("waiting", { count: queue.length })}</p>
      </header>
      {queue.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol aria-label={t("queue")} className="rounded-lg border bg-card">
          {queue.map((checkIn) => (
            <li key={checkIn.id} className="border-b border-rule last:border-0">
              <Link href={`/coach/check-ins/${checkIn.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/60">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base font-medium">{checkIn.client.user.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {t("week", { date: day(checkIn.dueDate) })} · {t("sent", { date: format.dateTime(checkIn.createdAt, { weekday: "short", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" }) })}
                  </span>
                </span>
                {checkIn.questions && <Pill tone="accent">{t("hasQuestions")}</Pill>}
                <ChevronRightIcon aria-hidden className="size-4 flex-none text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
