"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CHECK_IN_SCALES } from "@/lib/enums";
import { submitCheckIn } from "./actions";

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

// The weekly check-in: each scale 1–10 with an optional comment, then questions for the coach.
export function CheckInForm() {
  const t = useTranslations("CheckIn");
  const id = useId();
  const [state, submit, pending] = useActionState(submitCheckIn, null);
  const invalid = (field: string) => Boolean(state && "invalid" in state && state.invalid.includes(field));
  return (
    <form action={submit} className="flex flex-col gap-4">
      {CHECK_IN_SCALES.map((scale) => (
        <fieldset key={scale} className="rounded-lg border bg-card p-5" aria-describedby={invalid(scale) ? `${id}-${scale}-note` : undefined}>
          <legend className="float-left w-full text-base font-semibold">{t(`scales.${scale}.title`)}</legend>
          <p className="clear-left pt-1 text-sm text-muted-foreground">{t(`scales.${scale}.hint`)}</p>
          <div className="mt-3 grid grid-cols-10 gap-1">
            {SCORES.map((score) => (
              <label
                key={score}
                className="flex h-10 cursor-pointer items-center justify-center rounded-md border bg-card text-sm tabular-nums transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-primary-soft has-checked:font-medium has-checked:text-primary-ink has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input type="radio" name={scale} value={score} required className="sr-only" aria-label={t("score", { scale: t(`scales.${scale}.title`), score })} />
                {score}
              </label>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{t(`scales.${scale}.low`)}</span>
            <span>{t(`scales.${scale}.high`)}</span>
          </div>
          {invalid(scale) && (
            <p id={`${id}-${scale}-note`} className="mt-2 text-xs text-destructive-ink">
              {t("pick")}
            </p>
          )}
          <Input name={`${scale}Comment`} maxLength={500} aria-label={t("commentFor", { scale: t(`scales.${scale}.title`) })} placeholder={t("comment")} className="mt-3 h-10" />
        </fieldset>
      ))}
      <div className="rounded-lg border bg-card p-5">
        <label htmlFor={`${id}-questions`} className="text-base font-semibold">
          {t("questions")}
        </label>
        <Textarea id={`${id}-questions`} name="questions" maxLength={2000} rows={4} className="mt-3" />
      </div>
      <p className="text-sm text-muted-foreground">
        {t.rich("bodyComp", {
          link: (chunks) => (
            <Link href="/app/progress#body" className="font-medium text-primary-ink hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
      {state && "already" in state && <p className="text-sm text-destructive-ink">{t("already")}</p>}
      <Button type="submit" disabled={pending} className="h-11 self-start px-5">
        {t("submit")}
      </Button>
    </form>
  );
}
