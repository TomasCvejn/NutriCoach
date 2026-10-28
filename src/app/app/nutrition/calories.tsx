"use client";

import { SearchIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { Field } from "@/components/field";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { FoodEntry } from "@/generated/prisma/client";
import type { FoodResult } from "@/lib/food-search";
import { nutrientsOf } from "@/lib/food-log";
import { addDays } from "@/lib/dates";
import { addFoodEntry, addQuickEntry, copyEntries, deleteEntry, type EntryState, updateEntry } from "./entry-actions";
import { FoodDialog } from "./food-dialog";

type Search = { results: FoodResult[]; offUnavailable: boolean };

function SlotSelect({ id, slots, slot }: { id: string; slots: string[]; slot: string }) {
  const t = useTranslations("Calories");
  return (
    <Field id={id} label={t("slot")}>
      <NativeSelect id={id} name="slot" defaultValue={slot} className="w-full [&_select]:h-10">
        {slots.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {s}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}

// "Add" in a meal slot: search (recent foods before typing; recent → custom → Open Food Facts) → the food → grams or a
// serving → the meal; or a quick add of kcal and macros.
export function AddFoodDialog({ date, slot, slots }: { date: string; slot: string; slots: string[] }) {
  const t = useTranslations("Calories");
  const [open, setOpen] = useState(false);
  const [quick, setQuick] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search | null>(null);
  const [food, setFood] = useState<FoodResult | null>(null);
  const [state, setState] = useState<EntryState>(null);

  // Debounced; the recent foods before two characters are typed. A newer request cancels the older one.
  useEffect(() => {
    if (!open || quick || food) return;
    const aborted = new AbortController();
    const timer = setTimeout(async () => {
      const q = query.trim();
      const res = await fetch(`/api/foods${q.length >= 2 ? `?q=${encodeURIComponent(q)}` : ""}`, { signal: aborted.signal }).catch(() => null);
      if (res?.ok) setSearch(await res.json());
    }, 300);
    return () => {
      clearTimeout(timer);
      aborted.abort();
    };
  }, [open, quick, food, query]);

  const done = (result: EntryState) => {
    setState(result);
    if (!result) setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuick(false);
          setQuery("");
          setSearch(null);
          setFood(null);
          setState(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="ghost" className="-mr-2.5 h-10 px-2.5 text-primary-ink sm:h-8" aria-label={t("addTo", { slot })} />}>{t("add")}</DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-5 p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{t("addTitle", { slot })}</DialogTitle>
          <DialogDescription className="sr-only">{t("addText")}</DialogDescription>
        </DialogHeader>
        <div role="group" aria-label={t("how")} className="flex gap-2">
          {[false, true].map((q) => (
            <button
              key={String(q)}
              type="button"
              aria-pressed={quick === q}
              onClick={() => setQuick(q)}
              className="flex h-10 items-center rounded-full border bg-card px-3.5 text-sm text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary-ink sm:h-8"
            >
              {t(q ? "quick" : "search")}
            </button>
          ))}
        </div>
        {quick ? (
          <QuickForm date={date} slot={slot} slots={slots} state={state} done={done} onCancel={() => setOpen(false)} />
        ) : food ? (
          <AmountForm date={date} slot={slot} slots={slots} food={food} state={state} done={done} onBack={() => setFood(null)} />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("searchLabel")} placeholder={t("searchPlaceholder")} className="h-10 pl-9" />
            </div>
            {search?.offUnavailable && (
              <p role="status" className="rounded-md border border-warning-edge bg-warning-soft px-3 py-2 text-xs text-warning">
                {t("offUnavailable")}
              </p>
            )}
            {search && (
              <>
                {query.trim().length < 2 && search.results.length > 0 && <p className="text-xs text-muted-foreground">{t("recent")}</p>}
                {search.results.length === 0 ? (
                  query.trim().length >= 2 && (
                    <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                      {t("nothingFound")}
                      <FoodDialog trigger={<Button variant="outline" className="h-10 px-3 sm:h-8">{t("createFood")}</Button>} />
                    </div>
                  )
                ) : (
                  <ul aria-label={t("results")} className="-mx-2 flex max-h-80 flex-col overflow-y-auto">
                    {search.results.map((r) => (
                      <li key={r.id ?? r.offCode}>
                        <button type="button" onClick={() => setFood(r)} className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-2.5 text-left text-sm hover:bg-muted">
                          <span className="min-w-0">
                            <span className="font-medium">{r.name}</span>
                            {r.brand && <span className="text-muted-foreground"> · {r.brand}</span>}
                          </span>
                          <span className="flex-none text-xs text-muted-foreground tabular-nums">{t("kcalPer100", { kcal: Math.round(r.kcal) })}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type FormProps = { date: string; slot: string; slots: string[]; state: EntryState; done: (result: EntryState) => void };

function AmountForm({ date, slot, slots, food, state, done, onBack }: FormProps & { food: FoodResult; onBack: () => void }) {
  const t = useTranslations("Calories");
  const format = useFormatter();
  const id = useId();
  const [by, setBy] = useState<number | "grams">(food.servings.length ? 0 : "grams"); // a serving index or grams
  const [value, setValue] = useState(food.servings.length ? "1" : "100");
  const grams = by === "grams" ? Number(value) || 0 : food.servings[by].grams * (Number(value) || 0);
  const n = nutrientsOf(food, grams);
  const invalid = (field: string) => Boolean(state && "invalid" in state && state.invalid.includes(field));
  return (
    <form action={async (form) => done(await addFoodEntry(form))} className="flex flex-col gap-4">
      <input type="hidden" name="date" value={date} />
      {food.id ? <input type="hidden" name="foodId" value={food.id} /> : <input type="hidden" name="offCode" value={food.offCode ?? ""} />}
      <input type="hidden" name="by" value={by === "grams" ? "grams" : "serving"} />
      {by !== "grams" && <input type="hidden" name="serving" value={by} />}
      <div>
        <p className="font-medium">{food.name}</p>
        <p className="text-xs text-muted-foreground">{[food.brand, t("kcalPer100", { kcal: Math.round(food.kcal) })].filter(Boolean).join(" · ")}</p>
      </div>
      {food.servings.length > 0 && (
        <div role="group" aria-label={t("unit")} className="flex flex-wrap gap-2">
          {[...food.servings.map((s, i) => [i, t("serving", { label: s.label, grams: format.number(s.grams) })] as const), ["grams", t("grams")] as const].map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={by === key}
              onClick={() => {
                setBy(key);
                setValue(key === "grams" ? "100" : "1");
              }}
              className="flex h-10 items-center rounded-full border bg-card px-3.5 text-sm text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary-ink sm:h-8"
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-amount`} label={by === "grams" ? t("gramsLabel") : t("count")} error={invalid("grams") || invalid("count") ? t("invalid") : undefined}>
          <Input
            id={`${id}-amount`}
            name={by === "grams" ? "grams" : "count"}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-describedby={`${id}-amount-note`}
            className="h-10 tabular-nums"
          />
        </Field>
        <SlotSelect id={`${id}-slot`} slots={slots} slot={slot} />
      </div>
      <p className="text-sm tabular-nums" aria-live="polite">
        {t("preview", { kcal: format.number(Math.round(n.kcal)), protein: format.number(n.protein, { maximumFractionDigits: 1 }), carbs: format.number(n.carbs, { maximumFractionDigits: 1 }), fat: format.number(n.fat, { maximumFractionDigits: 1 }) })}
      </p>
      {state && "offUnavailable" in state && <p className="text-sm text-destructive-ink">{t("offUnavailableAdd")}</p>}
      <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack} className="h-10">
          {t("back")}
        </Button>
        <Button type="submit" className="h-10 px-4">
          {t("addButton")}
        </Button>
      </div>
    </form>
  );
}

const QUICK = ["kcal", "protein", "carbs", "fat"] as const;

function QuickForm({ date, slot, slots, state, done, onCancel }: FormProps & { onCancel: () => void }) {
  const t = useTranslations("Calories");
  const id = useId();
  const invalid = (field: string) => Boolean(state && "invalid" in state && state.invalid.includes(field));
  return (
    <form action={async (form) => done(await addQuickEntry(form))} className="flex flex-col gap-4">
      <input type="hidden" name="date" value={date} />
      <QuickFields id={id} invalid={invalid} />
      <SlotSelect id={`${id}-slot`} slots={slots} slot={slot} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="h-10">
          {t("cancel")}
        </Button>
        <Button type="submit" className="h-10 px-4">
          {t("addButton")}
        </Button>
      </div>
    </form>
  );
}

function QuickFields({ id, invalid, entry }: { id: string; invalid: (field: string) => boolean; entry?: FoodEntry }) {
  const t = useTranslations("Calories");
  return (
    <>
      <Field id={`${id}-name`} label={t("quickName")} error={invalid("name") ? t("invalid") : undefined}>
        <Input id={`${id}-name`} name="name" maxLength={100} defaultValue={entry?.name ?? ""} aria-describedby={`${id}-name-note`} className="h-10" />
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {QUICK.map((f) => (
          <Field key={f} id={`${id}-${f}`} label={t(`fields.${f}`)} error={invalid(f) ? t("invalid") : undefined}>
            <Input
              id={`${id}-${f}`}
              name={f}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              required={f === "kcal"}
              defaultValue={entry?.[f] ?? ""}
              aria-describedby={`${id}-${f}-note`}
              className="h-10 tabular-nums"
            />
          </Field>
        ))}
      </div>
    </>
  );
}

// A logged entry's "Edit": its amount (grams, or the count of its serving) or a quick add's numbers, its meal, delete.
export function EditEntryDialog({ entry, label, slots }: { entry: FoodEntry; label: string; slots: string[] }) {
  const t = useTranslations("Calories");
  const id = useId();
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" className="-mr-2.5 h-10 px-2.5 sm:h-8" aria-label={label}>
          {t("edit")}
        </Button>
      }
      title={t("editTitle")}
      save={async (form) => {
        const result = await updateEntry(form);
        return result && "invalid" in result ? result : null;
      }}
      remove={deleteEntry}
    >
      {(invalid) => (
        <>
          <input type="hidden" name="id" value={entry.id} />
          {entry.grams == null ? (
            <QuickFields id={id} invalid={invalid} entry={entry} />
          ) : (
            <div>
              <p className="font-medium">{entry.name}</p>
              <div className="mt-3">
                <Field id={`${id}-amount`} label={entry.servingCount != null ? t("countOf", { serving: entry.servingLabel ?? "" }) : t("gramsLabel")} error={invalid("grams") || invalid("count") ? t("invalid") : undefined}>
                  <Input
                    id={`${id}-amount`}
                    name={entry.servingCount != null ? "count" : "grams"}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    required
                    defaultValue={entry.servingCount ?? entry.grams}
                    aria-describedby={`${id}-amount-note`}
                    className="h-10 tabular-nums"
                  />
                </Field>
              </div>
            </div>
          )}
          <SlotSelect id={`${id}-slot`} slots={slots} slot={entry.slot} />
        </>
      )}
    </FormDialog>
  );
}

// "Copy" a meal (slot) or the whole day from another date, yesterday by default.
export function CopyDialog({ date, slot }: { date: string; slot?: string }) {
  const t = useTranslations("Calories");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [nothing, setNothing] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setNothing(false);
      }}
    >
      <DialogTrigger
        render={
          slot ? (
            <Button variant="ghost" className="h-10 px-2.5 text-primary-ink sm:h-8" aria-label={t("copyTo", { slot })} />
          ) : (
            <Button variant="outline" className="h-10 self-start px-3 sm:h-8" />
          )
        }
      >
        {slot ? t("copy") : t("copyDay")}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-5 p-6 sm:max-w-sm">
        <form
          action={async (form) => {
            const result = await copyEntries(form);
            if ("copied" in result && result.copied > 0) setOpen(false);
            else setNothing(true);
          }}
          className="flex flex-col gap-5"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{slot ? t("copyTitle", { slot }) : t("copyDayTitle")}</DialogTitle>
            <DialogDescription>{slot ? t("copyText") : t("copyDayText")}</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="date" value={date} />
          {slot && <input type="hidden" name="slot" value={slot} />}
          <Field id={`${id}-from`} label={t("copyFrom")} error={nothing ? t(slot ? "copyNothing" : "copyDayNothing") : undefined}>
            <Input id={`${id}-from`} type="date" name="from" required defaultValue={addDays(date, -1)} max={addDays(date, -1)} aria-describedby={`${id}-from-note`} className="h-10" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-10">
              {t("cancel")}
            </Button>
            <Button type="submit" className="h-10 px-4">
              {t("copyButton")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
