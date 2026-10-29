import { ChevronLeftIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SupplementCategory } from "@/lib/enums";
import { SupplementDialog } from "../supplement-dialog";

// One supplement for the client: dose, timing, purpose, notes and when; their own ones they can edit.
export default async function ClientSupplement({ params }: PageProps<"/app/supplements/[id]">) {
  const { client } = await requireClient();
  const supplement = await db.supplement.findFirst({ where: { id: (await params).id, clientId: client.id } });
  if (!supplement) notFound();
  const [t, format] = await Promise.all([getTranslations("Supplements"), getFormatter()]);
  const day = (date: string) => format.dateTime(new Date(date), { dateStyle: "medium", timeZone: "UTC" });
  const facts = (
    [
      ["dose", supplement.dose],
      ["timing", supplement.timing],
      ["purpose", supplement.purpose],
      ["notes", supplement.notes],
      ["active", [supplement.activeFrom && t("from", { date: day(supplement.activeFrom) }), supplement.activeTo && t("until", { date: day(supplement.activeTo) })].filter(Boolean).join(" · ")],
    ] as const
  ).filter(([, value]) => value);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/app/supplements" className="-ml-1 inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-4" aria-hidden />
            {t("title")}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{supplement.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{[supplement.brand, t(`categories.${supplement.category as SupplementCategory}`), supplement.addedByClient && t("yours")].filter(Boolean).join(" · ")}</p>
        </div>
        {supplement.addedByClient && <SupplementDialog clientId={client.id} supplement={supplement} trigger={<Button variant="outline" className="h-10 px-4 sm:h-8 sm:px-3">{t("edit")}</Button>} />}
      </header>
      <dl className="rounded-lg border bg-card px-5">
        {facts.map(([key, value]) => (
          <div key={key} className="border-t border-rule py-3 first:border-0">
            <dt className="text-sm text-muted-foreground">{t(`fields.${key}`)}</dt>
            <dd className="mt-1 text-base whitespace-pre-line">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
