import { ChevronLeftIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth";
import type { CheckInAnswers } from "@/lib/check-ins";
import { db } from "@/lib/db";
import { FEEDBACK_FIELDS } from "@/lib/enums";
import { ContextComments } from "../../messages/context-comments";
import { SentAnswers } from "../sent-answers";

// One of the client's check-ins: the coach's feedback once published (opening it is what clears "new feedback" on the
// home screen), then what the client sent.
export default async function CheckInResults({ params }: PageProps<"/app/check-in/[id]">) {
  const { client } = await requireClient();
  const checkIn = await db.checkIn.findFirst({ where: { id: (await params).id, clientId: client.id } });
  if (!checkIn) notFound();
  if (checkIn.reviewedAt && !checkIn.feedbackSeenAt) await db.checkIn.update({ where: { id: checkIn.id }, data: { feedbackSeenAt: new Date() } });
  const [t, format] = await Promise.all([getTranslations("CheckIn"), getFormatter()]);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <header>
        <Link href="/app/check-in" className="-ml-1 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-4" aria-hidden />
          {t("title")}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight first-letter:uppercase">
          {t("weekOf", { date: format.dateTime(new Date(checkIn.dueDate), { day: "numeric", month: "long", timeZone: "UTC" }) })}
        </h1>
      </header>

      {checkIn.reviewedAt ? (
        <section aria-labelledby="feedback" className="rounded-lg border bg-card p-5">
          <h2 id="feedback" className="text-base font-semibold">
            {t("fromCoach")}
          </h2>
          <dl className="mt-2">
            {FEEDBACK_FIELDS.filter((field) => checkIn[field]).map((field) => (
              <div key={field} className="border-t border-rule py-3 first:border-0">
                <dt className="text-sm text-muted-foreground">{t(`feedbackFields.${field}`)}</dt>
                <dd className="mt-1 text-base whitespace-pre-line">{checkIn[field]}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("notReviewed")}</p>
      )}

      <section aria-labelledby="sent" className="rounded-lg border bg-card p-5">
        <h2 id="sent" className="text-base font-semibold">
          {t("yourAnswers")}
        </h2>
        <SentAnswers answers={checkIn.answers as CheckInAnswers} questions={checkIn.questions} />
      </section>
      <ContextComments clientId={client.id} type="CHECK_IN" contextKey={checkIn.id} />
    </div>
  );
}
