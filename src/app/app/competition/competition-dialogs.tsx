"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useId } from "react";
import { Field } from "@/components/field";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Competition } from "@/generated/prisma/client";
import { COMPETITION_PRIORITIES } from "@/lib/enums";
import { deleteCompetition, saveCompetition, saveResult } from "./actions";

// The coach adds a competition (no `competition`) or edits one, with delete while editing.
export function CompetitionDialog({ clientId, competition, trigger }: { clientId: string; competition?: Competition; trigger: ReactElement<Record<string, unknown>> }) {
  const t = useTranslations("Competition");
  const id = useId();
  const text = (name: "name" | "sport" | "location", invalid: (field: string) => boolean, required = false) => (
    <Field id={`${id}-${name}`} label={t(`fields.${name}`)} error={invalid(name) ? t(`invalid.${name}`) : undefined}>
      <Input id={`${id}-${name}`} name={name} required={required} maxLength={100} defaultValue={competition?.[name] ?? ""} aria-describedby={`${id}-${name}-note`} className="h-10" />
    </Field>
  );
  return (
    <FormDialog trigger={trigger} title={t(competition ? "editTitle" : "addTitle")} save={saveCompetition} remove={competition && deleteCompetition}>
      {(invalid) => (
        <>
          <input type="hidden" name="clientId" value={clientId} />
          {competition && <input type="hidden" name="id" value={competition.id} />}
          {text("name", invalid, true)}
          <div className="grid grid-cols-2 gap-4">
            <Field id={`${id}-date`} label={t("fields.date")} error={invalid("date") ? t("invalid.date") : undefined}>
              <Input id={`${id}-date`} name="date" type="date" required defaultValue={competition?.date ?? ""} aria-describedby={`${id}-date-note`} className="h-10" />
            </Field>
            <Field id={`${id}-priority`} label={t("fields.priority")}>
              <NativeSelect id={`${id}-priority`} name="priority" defaultValue={competition?.priority ?? "A"} className="w-full [&_select]:h-10">
                {COMPETITION_PRIORITIES.map((p) => (
                  <NativeSelectOption key={p} value={p}>
                    {t(`priorities.${p}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {text("sport", invalid)}
            {text("location", invalid)}
          </div>
          <Field id={`${id}-notes`} label={t("fields.notes")}>
            <Textarea id={`${id}-notes`} name="notes" maxLength={2000} rows={3} defaultValue={competition?.notes ?? ""} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

// The result and how it felt, by the client or the coach.
export function ResultDialog({ competition, trigger }: { competition: Competition; trigger: ReactElement<Record<string, unknown>> }) {
  const t = useTranslations("Competition");
  const id = useId();
  return (
    <FormDialog trigger={trigger} title={t("resultTitle", { name: competition.name })} save={saveResult}>
      {(invalid) => (
        <>
          <input type="hidden" name="clientId" value={competition.clientId} />
          <input type="hidden" name="id" value={competition.id} />
          <Field id={`${id}-result`} label={t("fields.result")} hint={t("resultHint")}>
            <Input id={`${id}-result`} name="result" maxLength={200} defaultValue={competition.result ?? ""} aria-describedby={`${id}-result-note`} className="h-10" />
          </Field>
          <Field id={`${id}-felt`} label={t("fields.felt")} hint={t("feltHint")} error={invalid("felt") ? t("invalid.felt") : undefined}>
            <Input id={`${id}-felt`} name="felt" type="number" inputMode="numeric" min={1} max={10} defaultValue={competition.felt ?? ""} aria-describedby={`${id}-felt-note`} className="h-10 w-24 tabular-nums" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
