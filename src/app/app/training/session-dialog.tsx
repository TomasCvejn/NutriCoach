"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useId } from "react";
import { Field } from "@/components/field";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { TrainingSession } from "@/generated/prisma/client";
import { INTENSITIES, SESSION_TYPES } from "@/lib/enums";
import { deleteSession, saveSession } from "./actions";

// Add a session (no `session`; it can repeat weekly) or edit one: the plan, then how it went (RPE, felt, note).
export function SessionDialog({ clientId, date, session, trigger }: { clientId: string; date: string; session?: TrainingSession; trigger: ReactElement<Record<string, unknown>> }) {
  const t = useTranslations("Training");
  const id = useId();
  const field = (name: string, invalid: (field: string) => boolean, input: ReactElement, hint?: string) => (
    <Field id={`${id}-${name}`} label={t(`fields.${name}`)} hint={hint} error={invalid(name) ? t(`invalid.${name}`) : undefined}>
      {input}
    </Field>
  );
  const note = (name: string) => `${id}-${name}-note`;
  const score = (name: "rpe" | "felt", invalid: (field: string) => boolean) =>
    field(
      name,
      invalid,
      <Input id={`${id}-${name}`} name={name} type="number" inputMode="numeric" min={1} max={10} defaultValue={session?.[name] ?? ""} aria-describedby={note(name)} className="h-10 tabular-nums" />,
      t(`hints.${name}`),
    );
  return (
    <FormDialog trigger={trigger} title={t(session ? "editTitle" : "addTitle")} save={saveSession} remove={session && deleteSession}>
      {(invalid) => (
        <>
          <input type="hidden" name="clientId" value={clientId} />
          {session && <input type="hidden" name="id" value={session.id} />}
          <div className="grid grid-cols-2 gap-4">
            {field("date", invalid, <Input id={`${id}-date`} name="date" type="date" required defaultValue={session?.date ?? date} aria-describedby={note("date")} className="h-10" />)}
            {field("startTime", invalid, <Input id={`${id}-startTime`} name="startTime" type="time" defaultValue={session?.startTime ?? ""} aria-describedby={note("startTime")} className="h-10" />)}
            {field(
              "type",
              invalid,
              <NativeSelect id={`${id}-type`} name="type" defaultValue={session?.type ?? "RUN"} className="w-full [&_select]:h-10">
                {SESSION_TYPES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {t(`types.${type}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>,
            )}
            {field("sport", invalid, <Input id={`${id}-sport`} name="sport" maxLength={100} defaultValue={session?.sport ?? ""} aria-describedby={note("sport")} className="h-10" />)}
            {field(
              "durationMin",
              invalid,
              <Input id={`${id}-durationMin`} name="durationMin" type="number" inputMode="numeric" min={1} max={720} required defaultValue={session?.durationMin ?? ""} aria-describedby={note("durationMin")} className="h-10 tabular-nums" />,
            )}
            {field(
              "intensity",
              invalid,
              <NativeSelect id={`${id}-intensity`} name="intensity" defaultValue={session?.intensity ?? "MODERATE"} className="w-full [&_select]:h-10">
                {INTENSITIES.map((intensity) => (
                  <NativeSelectOption key={intensity} value={intensity}>
                    {t(`intensities.${intensity}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>,
            )}
          </div>
          {field("description", invalid, <Textarea id={`${id}-description`} name="description" maxLength={1000} rows={2} defaultValue={session?.description ?? ""} />)}
          {!session && field("repeatUntil", invalid, <Input id={`${id}-repeatUntil`} name="repeatUntil" type="date" aria-describedby={note("repeatUntil")} className="h-10" />, t("repeatHint"))}
          <fieldset className="flex flex-col gap-4 border-t border-rule pt-4">
            <legend className="float-left mb-1 text-sm font-semibold">{t("after")}</legend>
            <div className="clear-both grid grid-cols-2 gap-4">
              {score("rpe", invalid)}
              {score("felt", invalid)}
            </div>
            {field("note", invalid, <Textarea id={`${id}-note`} name="note" maxLength={1000} rows={2} defaultValue={session?.note ?? ""} />)}
          </fieldset>
        </>
      )}
    </FormDialog>
  );
}
