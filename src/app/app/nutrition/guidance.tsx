"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FOLLOWED, type Followed } from "@/lib/enums";
import { saveGuidance } from "./guidance-actions";

// Yes reads good, partly a notice, no bad; pressed again it clears.
const TONE: Record<Followed, string> = {
  YES: "aria-pressed:border-positive aria-pressed:bg-positive-soft aria-pressed:text-positive-ink",
  PARTLY: "aria-pressed:border-warning-edge aria-pressed:bg-warning-soft aria-pressed:text-warning",
  NO: "aria-pressed:border-destructive aria-pressed:bg-destructive-soft aria-pressed:text-destructive-ink",
};

// A GUIDANCE meal: "Followed?" applies at once, the note saves with its button.
export function GuidanceMeal({ date, slot, followed, note }: { date: string; slot: string; followed: Followed | null; note: string | null }) {
  const t = useTranslations("Guidance");
  const [value, setValue] = useState(followed);
  const [text, setText] = useState(note ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const save = (next: Followed | null, nextNote: string, onSaved?: () => void) => {
    const form = new FormData();
    for (const [k, v] of Object.entries({ date, slot, followed: next ?? "", note: nextNote })) form.set(k, v);
    start(async () => {
      await saveGuidance(form);
      onSaved?.();
    });
  };
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div role="group" aria-label={t("followedIn", { slot })} className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("followed")}</span>
        {FOLLOWED.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={value === f}
            onClick={() => {
              const next = value === f ? null : f;
              setValue(next);
              save(next, text);
            }}
            className={`flex h-10 items-center rounded-full border bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:h-8 ${TONE[f]}`}
          >
            {t(`options.${f}`)}
          </button>
        ))}
      </div>
      <details open={Boolean(note)} className="text-sm">
        <summary className="cursor-pointer text-primary-ink">{t("note")}</summary>
        <div className="mt-2 flex flex-col gap-2">
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSaved(false);
            }}
            maxLength={1000}
            rows={2}
            aria-label={t("noteFor", { slot })}
          />
          <div className="flex items-center justify-end gap-3">
            <p role="status" className="text-sm text-muted-foreground">
              {saved && !pending && t("saved")}
            </p>
            <Button type="button" variant="outline" disabled={pending} onClick={() => save(value, text, () => setSaved(true))} className="h-10 sm:h-8">
              {t("saveNote")}
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}
