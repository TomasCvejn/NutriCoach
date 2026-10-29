import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Pill } from "@/components/pill";
import { Button } from "@/components/ui/button";
import type { Supplement } from "@/generated/prisma/client";
import { todayIn } from "@/lib/dates";
import { db } from "@/lib/db";
import { SUPPLEMENT_CATEGORIES } from "@/lib/enums";
import { SupplementDialog } from "./supplement-dialog";

// A client's supplements for the client (More → Supplements: each opens its page; they add and edit their own) and the
// coach (Supplements tab: assigns and edits any; the client's own are flagged): the current ones by category, then the
// ended ones.
export async function SupplementList({ clientId, timezone, viewer }: { clientId: string; timezone: string; viewer: "client" | "coach" }) {
  const today = todayIn(timezone);
  const [t, format, supplements] = await Promise.all([getTranslations("Supplements"), getFormatter(), db.supplement.findMany({ where: { clientId }, orderBy: { name: "asc" } })]);
  const ended = supplements.filter((s) => s.activeTo && s.activeTo < today);
  const current = supplements.filter((s) => !ended.includes(s));
  const day = (date: string) => format.dateTime(new Date(date), { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
  const canEdit = (s: Supplement) => viewer === "coach" || s.addedByClient;

  const row = (s: Supplement) => (
    <li key={s.id} className="flex items-start justify-between gap-3 border-t border-rule py-3 first:border-0">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {viewer === "client" ? (
            <Link href={`/app/supplements/${s.id}`} className="font-medium hover:underline">
              {s.name}
            </Link>
          ) : (
            <span className="font-medium">{s.name}</span>
          )}
          {s.brand && <span className="text-muted-foreground">{s.brand}</span>}
          {viewer === "coach" && s.addedByClient && <Pill tone="accent">{t("addedByClient")}</Pill>}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {[s.dose, s.timing, s.activeFrom && s.activeFrom > today && t("from", { date: day(s.activeFrom) }), s.activeTo && t("until", { date: day(s.activeTo) })].filter(Boolean).join(" · ")}
        </p>
      </div>
      {canEdit(s) && (
        <SupplementDialog
          clientId={clientId}
          supplement={s}
          trigger={
            <Button variant="ghost" className="-mr-2.5 h-10 flex-none px-2.5 sm:h-8" aria-label={t("editFor", { name: s.name })}>
              {t("edit")}
            </Button>
          }
        />
      )}
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SupplementDialog clientId={clientId} trigger={<Button className="h-10 px-4 sm:h-8 sm:px-3">{t(viewer === "coach" ? "assign" : "addOwn")}</Button>} />
      </div>
      {current.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t(viewer === "coach" ? "emptyCoach" : "empty")}</p>
      ) : (
        SUPPLEMENT_CATEGORIES.filter((c) => current.some((s) => s.category === c)).map((category) => (
          <section key={category} aria-labelledby={`supplements-${category}`} className="rounded-lg border bg-card p-5">
            <h2 id={`supplements-${category}`} className="text-base font-semibold">
              {t(`categories.${category}`)}
            </h2>
            <ul className="mt-2">{current.filter((s) => s.category === category).map(row)}</ul>
          </section>
        ))
      )}
      {ended.length > 0 && (
        <section aria-labelledby="supplements-ended" className="flex flex-col gap-2">
          <h2 id="supplements-ended" className="text-base font-semibold text-muted-foreground">
            {t("ended")}
          </h2>
          <ul>{ended.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
