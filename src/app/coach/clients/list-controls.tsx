"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Form from "next/form";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ListParams } from "@/lib/client-list";
import { TRACKING_MODES } from "@/lib/enums";
import { setClientActive } from "./actions";

// Search and the mode filter as a GET form: the URL holds the view. Typing applies after a pause, the select at once.
// ponytail: uncontrolled fields; nothing but this form and ClearFilters changes q / mode (filtering replaces the history entry).
export function ClientFilters({ params }: { params: ListParams }) {
  const t = useTranslations();
  const typing = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <Form id="client-filters" action="/coach/clients" replace className="flex gap-3">
      <input type="hidden" name="status" value={params.status} />
      <input type="hidden" name="sort" value={params.sort} />
      <input type="hidden" name="dir" value={params.dir} />
      <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          defaultValue={params.q}
          maxLength={100}
          aria-label={t("Clients.search")}
          placeholder={t("Clients.searchPlaceholder")}
          className="h-10 bg-card pl-9 sm:h-8"
          onChange={(e) => {
            const form = e.currentTarget.form;
            clearTimeout(typing.current);
            typing.current = setTimeout(() => form?.requestSubmit(), 300);
          }}
        />
      </div>
      <NativeSelect name="mode" defaultValue={params.mode ?? ""} aria-label={t("Clients.modeFilter")} className="[&_select]:h-10 [&_select]:bg-card sm:[&_select]:h-8" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <NativeSelectOption value="">{t("Clients.allModes")}</NativeSelectOption>
        {TRACKING_MODES.map((m) => (
          <NativeSelectOption key={m} value={m}>
            {t(`TrackingModes.${m}`)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Form>
  );
}

export function ClearFilters() {
  const t = useTranslations("Clients");
  return (
    <button
      type="button"
      className="font-medium text-foreground underline-offset-4 hover:underline"
      onClick={() => {
        const form = document.getElementById("client-filters") as HTMLFormElement;
        form.q.value = form.mode.value = "";
        form.requestSubmit();
      }}
    >
      {t("clearFilters")}
    </button>
  );
}

// Deactivation signs the client out, so it asks first; reactivating is a plain button.
export function DeactivateButton({ clientId, name }: { clientId: string; name: string }) {
  const t = useTranslations("Clients.deactivate");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" className="h-10 text-muted-foreground sm:h-8" aria-label={t("for", { name })} />}>{t("open")}</DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-6 p-6 sm:max-w-md">
        <form
          action={async (form) => {
            await setClientActive(form);
            setOpen(false);
          }}
          className="flex flex-col gap-6"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="active" value="false" />
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{t("title", { name })}</DialogTitle>
            <DialogDescription>{t("text")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 px-6">
            <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
            <Button type="submit" variant="destructive">
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
