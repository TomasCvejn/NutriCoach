"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// A dialog with one form to add or edit, and delete while editing. Every opening starts a fresh form.
export function FormDialog({
  trigger,
  title,
  save,
  remove,
  children,
}: {
  trigger: ReactElement<Record<string, unknown>>;
  title: string;
  save: (form: FormData) => Promise<{ invalid: string[] } | null>;
  remove?: (form: FormData) => Promise<void>;
  children: (invalid: (field: string) => boolean) => ReactNode;
}) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(0);
  const [invalid, setInvalid] = useState<string[]>([]);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setInvalid([]);
          setOpened((n) => n + 1);
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent showCloseButton={false} className="gap-6 p-6 sm:max-w-lg">
        <form
          key={opened}
          action={async (form) => {
            const result = await save(form);
            setInvalid(result?.invalid ?? []);
            if (!result) setOpen(false);
          }}
          className="flex flex-col gap-6"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">{children((field) => invalid.includes(field))}</div>
          <DialogFooter className="-mx-6 -mb-6 px-6">
            {remove && (
              <Button
                type="submit"
                variant="destructive"
                formNoValidate
                formAction={async (form) => {
                  await remove(form);
                  setOpen(false);
                }}
                className="sm:mr-auto"
              >
                {t("delete")}
              </Button>
            )}
            <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
            <Button type="submit">{t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
