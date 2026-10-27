"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TRACKING_MODES } from "@/lib/enums";
import { createInvite } from "./actions";

// "Invite client": the form, then the link to send. Every opening starts a fresh form.
export function InviteDialog() {
  const t = useTranslations("Clients.invite");
  const [opened, setOpened] = useState(0);
  return (
    <Dialog onOpenChange={(open) => open && setOpened((n) => n + 1)}>
      <DialogTrigger render={<Button className="h-9 px-3" />}>{t("open")}</DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-6 p-6 sm:max-w-md">
        <InviteForm key={opened} />
      </DialogContent>
    </Dialog>
  );
}

function InviteForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(createInvite, null);

  if (state && "token" in state) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{t("Clients.invite.linkTitle", { name: state.name })}</DialogTitle>
          <DialogDescription>{t("Clients.invite.linkNote")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-link">{t("Clients.invite.linkLabel")}</Label>
          <div className="flex">
            <Input id="invite-link" readOnly value={inviteUrl(state.token)} onFocus={(e) => e.target.select()} className="rounded-r-none" />
            <CopyLinkButton token={state.token} className="rounded-l-none border-l-0" />
          </div>
        </div>
        <DialogFooter className="-mx-6 -mb-6 px-6">
          <DialogClose render={<Button />}>{t("Clients.invite.done")}</DialogClose>
        </DialogFooter>
      </>
    );
  }

  const invalid = (field: string) => Boolean(state && "invalid" in state && state.invalid.includes(field));
  return (
    <form action={action} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">{t("Clients.invite.title")}</DialogTitle>
        <DialogDescription>{t("Clients.invite.description")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <Field id="invite-name" label={t("Clients.invite.name")} error={invalid("name") ? t("Clients.invite.nameInvalid") : undefined}>
          <Input id="invite-name" name="name" required maxLength={100} autoComplete="off" aria-invalid={invalid("name")} aria-describedby="invite-name-note" />
        </Field>
        <Field id="invite-email" label={t("Clients.invite.email")} hint={t("Clients.invite.emailHint")} error={invalid("email") ? t("Clients.invite.emailInvalid") : undefined}>
          <Input id="invite-email" name="email" type="email" autoComplete="off" aria-invalid={invalid("email")} aria-describedby="invite-email-note" />
        </Field>
        <Field id="invite-mode" label={t("Clients.invite.mode")}>
          <NativeSelect id="invite-mode" name="trackingMode" className="w-full">
            <NativeSelectOption value="">{t("Clients.invite.clientChooses")}</NativeSelectOption>
            {TRACKING_MODES.map((m) => (
              <NativeSelectOption key={m} value={m}>
                {t(`TrackingModes.${m}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <DialogFooter className="-mx-6 -mb-6 px-6">
        <DialogClose render={<Button variant="outline" />}>{t("Clients.invite.cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {t("Clients.invite.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Label above the field, then the hint or the error (the field points at it with aria-describedby="<id>-note").
function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  const note = error ?? hint;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {note && (
        <p id={`${id}-note`} className={error ? "text-xs text-destructive-ink" : "text-xs text-muted-foreground"}>
          {note}
        </p>
      )}
    </div>
  );
}

const inviteUrl = (token: string) => new URL(`/invite/${token}`, location.origin).href;

export function CopyLinkButton({ token, className }: { token: string; className?: string }) {
  const t = useTranslations("Clients");
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(inviteUrl(token));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <span aria-live="polite">{copied ? t("copied") : t("copyLink")}</span>
    </Button>
  );
}
