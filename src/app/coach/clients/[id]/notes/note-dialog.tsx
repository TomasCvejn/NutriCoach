"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CoachNote } from "@/generated/prisma/client";
import { NOTE_TYPES } from "@/lib/enums";
import { deleteNote, saveNote } from "./actions";

type Note = Pick<CoachNote, "id" | "date" | "type" | "text" | "pinned">;

// Add a note (the header's action) or edit one (its row), with delete while editing. Every opening starts a fresh form.
export function NoteDialog({ clientId, today, note, label }: { clientId: string; today: string; note?: Note; label?: string }) {
  const t = useTranslations("Notes");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(0);
  const [invalid, setInvalid] = useState<string[]>([]);
  const error = (field: string) => (invalid.includes(field) ? t(`invalid.${field as "date" | "text"}`) : undefined);

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
      <DialogTrigger render={note ? <Button variant="ghost" className="h-10 sm:h-8" aria-label={label} /> : <Button variant="outline" className="h-10 px-3 sm:h-8" />}>
        {note ? t("edit") : t("add")}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-6 p-6 sm:max-w-lg">
        <form
          key={opened}
          action={async (form) => {
            const result = await saveNote(form);
            setInvalid(result?.invalid ?? []);
            if (!result) setOpen(false);
          }}
          className="flex flex-col gap-6"
        >
          <input type="hidden" name="clientId" value={clientId} />
          {note && <input type="hidden" name="id" value={note.id} />}
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{note ? t("editTitle") : t("addTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${id}-date`} label={t("date")} error={error("date")}>
                <Input id={`${id}-date`} type="date" name="date" required defaultValue={note?.date ?? today} aria-invalid={Boolean(error("date"))} aria-describedby={`${id}-date-note`} className="h-10" />
              </Field>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">{t("type")}</legend>
                <div className="flex gap-2">
                  {NOTE_TYPES.map((type) => (
                    <label
                      key={type}
                      className="flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors hover:bg-muted/60 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                    >
                      <input type="radio" name="type" value={type} defaultChecked={(note?.type ?? "NOTE") === type} className="size-4 accent-primary outline-none" />
                      {t(`types.${type}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <Field id={`${id}-text`} label={t("text")} error={error("text")}>
              <Textarea id={`${id}-text`} name="text" required maxLength={5000} rows={5} defaultValue={note?.text} aria-invalid={Boolean(error("text"))} aria-describedby={`${id}-text-note`} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pinned" defaultChecked={note?.pinned} className="size-4 accent-primary" />
              {t("pin")}
            </label>
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6">
            {note && (
              <Button
                type="submit"
                variant="destructive"
                formNoValidate
                formAction={async (form) => {
                  await deleteNote(form);
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
