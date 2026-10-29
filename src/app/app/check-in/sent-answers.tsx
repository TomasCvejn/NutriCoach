import { getTranslations } from "next-intl/server";
import type { CheckInAnswers } from "@/lib/check-ins";
import { CHECK_IN_SCALES } from "@/lib/enums";

// What the client sent: each scale's score and comment, then their questions.
export async function SentAnswers({ answers, questions }: { answers: CheckInAnswers; questions: string | null }) {
  const t = await getTranslations("CheckIn");
  return (
    <>
      <dl className="mt-3 text-sm">
        {CHECK_IN_SCALES.map((scale) => (
          <div key={scale} className="flex justify-between gap-4 border-t border-rule py-2">
            <dt className="text-muted-foreground">{t(`scales.${scale}.title`)}</dt>
            <dd className="text-right">
              <span className="tabular-nums">{t("outOf", { score: answers[scale].score })}</span>
              {answers[scale].comment && <span className="block text-xs text-muted-foreground">{answers[scale].comment}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {questions && <p className="mt-3 text-sm whitespace-pre-line">{questions}</p>}
    </>
  );
}
