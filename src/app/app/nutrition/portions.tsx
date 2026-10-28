"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TARGET_FIELDS } from "@/lib/nutrition";
import { setPortion } from "./portion-actions";

type Kind = (typeof TARGET_FIELDS.PORTIONS)[number];
type Counts = Record<Kind, number>;

// One meal's hand portions: − / + in half portions, the plan's count for this meal beside each. The count changes at
// once and the server catches up; the day's totals follow on the next render.
export function PortionCounters({ date, slot, counts, plan }: { date: string; slot: string; counts: Counts; plan: Partial<Record<Kind, number | null>> | null }) {
  const t = useTranslations();
  const format = useFormatter();
  const [values, setValues] = useState(counts);
  const [, start] = useTransition();
  const change = (kind: Kind, by: number) => {
    const value = Math.max(0, values[kind] + by);
    setValues({ ...values, [kind]: value });
    const form = new FormData();
    for (const [k, v] of Object.entries({ date, slot, kind, value: String(value) })) form.set(k, v);
    start(async () => {
      await setPortion(form);
    });
  };
  return (
    <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
      {TARGET_FIELDS.PORTIONS.map((kind) => {
        const label = t(`Targets.fields.${kind}`);
        return (
          <li key={kind} className="flex items-center justify-between gap-3 py-1">
            <span className="min-w-0 text-sm">
              {label}
              {plan?.[kind] != null && <span className="block text-xs text-muted-foreground">{t("Portions.plan", { value: format.number(plan[kind]!) })}</span>}
            </span>
            <span className="flex flex-none items-center gap-1">
              <Button type="button" variant="outline" size="icon" disabled={values[kind] === 0} onClick={() => change(kind, -0.5)} aria-label={t("Portions.less", { kind: label })} className="size-10 sm:size-8">
                <MinusIcon aria-hidden />
              </Button>
              <output aria-label={label} className="w-10 text-center text-base font-medium tabular-nums">
                {format.number(values[kind])}
              </output>
              <Button type="button" variant="outline" size="icon" disabled={values[kind] >= 20} onClick={() => change(kind, 0.5)} aria-label={t("Portions.more", { kind: label })} className="size-10 sm:size-8">
                <PlusIcon aria-hidden />
              </Button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
