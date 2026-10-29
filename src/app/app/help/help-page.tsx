import { getTranslations } from "next-intl/server";
import { PortionGuide } from "../nutrition/portion-guide";

const SECTIONS = ["using", "modes", "portions", "checkIns", "contact"] as const;
const MODES = ["CALORIES", "PORTIONS", "GUIDANCE"] as const;

// Help / FAQ (home-and-basics.md) for the client and the coach: static sections from the messages, each a question that
// opens; the hand-portion guide is the nutrition day's own.
export async function HelpPage({ role }: { role: "CLIENT" | "COACH" }) {
  const t = await getTranslations("Help");
  const area = role === "CLIENT" ? "client" : "coach";
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(`${area}.lead`)}</p>
      </header>
      {SECTIONS.map((section) =>
        section === "portions" ? (
          <PortionGuide key={section} open />
        ) : (
          <details key={section} open={section === "using"} className="rounded-lg border bg-card p-5 text-sm">
            <summary className="cursor-pointer font-semibold">{t(`${area}.${section}.title`)}</summary>
            {section === "modes" ? (
              <>
                <p className="mt-3">{t(`${area}.modes.text`)}</p>
                <dl className="mt-3 flex flex-col gap-3">
                  {MODES.map((mode) => (
                    <div key={mode}>
                      <dt className="font-medium">{t(`modes.${mode}.title`)}</dt>
                      <dd className="mt-0.5 text-muted-foreground">{t(`modes.${mode}.text`)}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="mt-3 whitespace-pre-line">{t(`${area}.${section}.text`)}</p>
            )}
          </details>
        ),
      )}
    </div>
  );
}
