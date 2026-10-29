import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Pill } from "@/components/pill";
import { requireCoachOf } from "@/lib/auth";
import type { CheckInAnswers } from "@/lib/check-ins";
import { db } from "@/lib/db";
import { CHECK_IN_SCALES } from "@/lib/enums";

// Check-ins tab: every check-in of the client, newest first, with its scores (the table view of the trends) and status.
export default async function ClientCheckIns({ params }: PageProps<"/coach/clients/[id]/check-ins">) {
  const { client } = await requireCoachOf((await params).id);
  const [t, format, checkIns] = await Promise.all([
    getTranslations(),
    getFormatter(),
    db.checkIn.findMany({ where: { clientId: client.id }, orderBy: { dueDate: "desc" }, select: { id: true, dueDate: true, answers: true, reviewedAt: true } }),
  ]);

  if (checkIns.length === 0) return <p className="max-w-3xl rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("CheckInReview.none")}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">{t("CheckInReview.history")}</caption>
        <thead>
          <tr className="border-b border-rule text-left text-xs text-muted-foreground">
            <th scope="col" className="sticky left-0 bg-card px-5 py-3 font-medium">
              {t("CheckInReview.weekOf")}
            </th>
            {CHECK_IN_SCALES.map((scale) => (
              <th key={scale} scope="col" className="px-3 py-3 text-right font-medium">
                {t(`CheckIn.scales.${scale}.title`)}
              </th>
            ))}
            <th scope="col" className="px-5 py-3 font-medium">
              {t("CheckInReview.status")}
            </th>
          </tr>
        </thead>
        <tbody>
          {checkIns.map((checkIn) => (
            <tr key={checkIn.id} className="border-b border-rule last:border-0">
              <th scope="row" className="sticky left-0 bg-card px-5 py-3 text-left font-medium whitespace-nowrap">
                <Link href={`/coach/check-ins/${checkIn.id}`} className="hover:underline">
                  {format.dateTime(new Date(checkIn.dueDate), { dateStyle: "medium", timeZone: "UTC" })}
                </Link>
              </th>
              {CHECK_IN_SCALES.map((scale) => (
                <td key={scale} className="px-3 py-3 text-right">
                  {(checkIn.answers as CheckInAnswers)[scale].score}
                </td>
              ))}
              <td className="px-5 py-3">{checkIn.reviewedAt ? <span className="text-muted-foreground">{t("CheckInReview.reviewed")}</span> : <Pill tone="accent">{t("Clients.checkIn.toReview")}</Pill>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
