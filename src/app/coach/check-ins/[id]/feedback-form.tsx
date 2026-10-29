"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_FIELDS } from "@/lib/enums";
import { publishFeedback } from "../actions";

// The coach's feedback: the response is required, the rest optional. Publishing marks the check-in reviewed.
export function FeedbackForm({ checkInId }: { checkInId: string }) {
  const t = useTranslations("CheckInReview");
  const id = useId();
  const [state, publish, pending] = useActionState(publishFeedback, null);
  return (
    <form action={publish} aria-labelledby={`${id}-title`} className="flex flex-col gap-5 rounded-lg border bg-card p-5">
      <h2 id={`${id}-title`} className="text-base font-semibold">
        {t("feedback")}
      </h2>
      <input type="hidden" name="checkInId" value={checkInId} />
      {FEEDBACK_FIELDS.map((field) => {
        const error = state?.invalid.includes(field) ? t("invalidResponse") : undefined;
        return (
          <Field key={field} id={`${id}-${field}`} label={t(`fields.${field}`)} hint={field === "response" ? undefined : t("optional")} error={error}>
            <Textarea
              id={`${id}-${field}`}
              name={field}
              required={field === "response"}
              maxLength={5000}
              rows={field === "response" ? 5 : 3}
              aria-invalid={Boolean(error)}
              aria-describedby={error || field !== "response" ? `${id}-${field}-note` : undefined}
            />
          </Field>
        );
      })}
      <Button type="submit" disabled={pending} className="h-10 self-start px-4">
        {t("publish")}
      </Button>
    </form>
  );
}
