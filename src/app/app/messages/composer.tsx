"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MessageContext } from "@/lib/enums";
import { sendMessage } from "./actions";

// Writing in the thread (`context`: as a comment on a day or a check-in); a sent message clears the box.
export function Composer({ clientId, context }: { clientId: string; context?: { type: MessageContext; key: string } }) {
  const t = useTranslations("Messages");
  const id = useId();
  const [sent, setSent] = useState(0);
  const [state, send, pending] = useActionState(async (previous: Awaited<ReturnType<typeof sendMessage>>, form: FormData) => {
    const result = await sendMessage(previous, form);
    if (!result) setSent((n) => n + 1);
    return result;
  }, null);
  return (
    <form action={send} className="flex flex-col gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      {context && (
        <>
          <input type="hidden" name="contextType" value={context.type} />
          <input type="hidden" name="contextKey" value={context.key} />
        </>
      )}
      <label htmlFor={`${id}-text`} className="sr-only">
        {t(context ? "comment" : "message")}
      </label>
      <Textarea
        key={sent}
        id={`${id}-text`}
        name="text"
        required
        maxLength={4000}
        rows={context ? 2 : 3}
        placeholder={t(context ? "commentPlaceholder" : "placeholder")}
        aria-invalid={Boolean(state)}
        aria-describedby={state ? `${id}-error` : undefined}
      />
      <div className="flex items-center justify-between gap-3">
        <p id={`${id}-error`} className="text-xs text-destructive-ink">
          {state ? t("invalid") : ""}
        </p>
        <Button type="submit" disabled={pending} className="h-10 px-5">
          {t("send")}
        </Button>
      </div>
    </form>
  );
}

// The open thread checks for new messages every 5 s (a refresh also updates the badges).
export function Poll({ ms = 5000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), ms);
    return () => clearInterval(timer);
  }, [router, ms]);
  return null;
}
