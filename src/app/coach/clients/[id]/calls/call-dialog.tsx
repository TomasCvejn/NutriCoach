"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useId } from "react";
import { Field } from "@/components/field";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Call } from "@/generated/prisma/client";
import { deleteCall, saveCall } from "./actions";

// The coach schedules a call (no `call`) or edits one, with delete while editing. `startsAt` is the call's time on the
// coach's clock ("YYYY-MM-DDTHH:MM").
export function CallDialog({ clientId, call, startsAt, trigger }: { clientId: string; call?: Call; startsAt?: string; trigger: ReactElement<Record<string, unknown>> }) {
  const t = useTranslations("Calls");
  const id = useId();
  return (
    <FormDialog trigger={trigger} title={t(call ? "editTitle" : "addTitle")} save={saveCall} remove={call && deleteCall}>
      {(invalid) => (
        <>
          <input type="hidden" name="clientId" value={clientId} />
          {call && <input type="hidden" name="id" value={call.id} />}
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-4">
            <Field id={`${id}-startsAt`} label={t("fields.startsAt")} hint={t("yourTime")} error={invalid("startsAt") ? t("invalid.startsAt") : undefined}>
              <Input id={`${id}-startsAt`} name="startsAt" type="datetime-local" required defaultValue={startsAt ?? ""} aria-describedby={`${id}-startsAt-note`} className="h-10" />
            </Field>
            <Field id={`${id}-duration`} label={t("fields.durationMin")} error={invalid("durationMin") ? t("invalid.durationMin") : undefined}>
              <Input id={`${id}-duration`} name="durationMin" type="number" inputMode="numeric" min={5} max={480} step={5} required defaultValue={call?.durationMin ?? 30} aria-describedby={`${id}-duration-note`} className="h-10 tabular-nums" />
            </Field>
          </div>
          <Field id={`${id}-link`} label={t("fields.link")} hint={t("linkHint")} error={invalid("link") ? t("invalid.link") : undefined}>
            <Input id={`${id}-link`} name="link" type="url" maxLength={500} placeholder="https://" defaultValue={call?.link ?? ""} aria-describedby={`${id}-link-note`} className="h-10" />
          </Field>
          <Field id={`${id}-agenda`} label={t("fields.agenda")}>
            <Textarea id={`${id}-agenda`} name="agenda" maxLength={2000} rows={3} defaultValue={call?.agenda ?? ""} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
