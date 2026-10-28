"use client";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { type ReactNode, useActionState, useId, useState } from "react";
import { Field } from "@/components/field";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { PlanMeal, PlanRecommendation } from "@/generated/prisma/client";
import { DAY_TYPES, type DayType, type TrackingMode } from "@/lib/enums";
import { TARGET_FIELDS } from "@/lib/nutrition";
import { copyPlan, deleteMeal, deleteRecommendation, reorderPlan, saveMeal, saveRecommendation, saveSpecifics } from "./actions";

type Meal = Pick<PlanMeal, "id" | "dayType" | "name" | "timeHint" | "guidance" | "palms" | "hands" | "fists" | "thumbs" | "note">;
type Recommendation = Pick<PlanRecommendation, "id" | "title" | "text">;

// A list the coach reorders with up / down, saved as one change ("Save order"), so the client gets one notification.
// Keyed by the server's order, so a saved change (or an added / deleted item) starts from the new list.
function OrderedList<T extends { id: string }>({
  items,
  label,
  hidden,
  render,
}: {
  items: T[];
  label: (item: T) => string;
  hidden: Record<string, string>;
  render: (item: T) => ReactNode;
}) {
  const t = useTranslations("Plan");
  const [order, setOrder] = useState(items);
  const changed = order.some((item, i) => item.id !== items[i].id);
  const move = (index: number, by: -1 | 1) =>
    setOrder((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  return (
    <>
      <ol className="mt-3">
        {order.map((item, index) => (
          <li key={item.id} className="flex items-start gap-3 border-b border-rule py-3 last:border-b-0">
            <div className="min-w-0 flex-1">{render(item)}</div>
            <div className="flex flex-none items-center">
              <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t("up", { name: label(item) })} className="size-10 sm:size-8">
                <ChevronUpIcon aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon" disabled={index === order.length - 1} onClick={() => move(index, 1)} aria-label={t("down", { name: label(item) })} className="size-10 sm:size-8">
                <ChevronDownIcon aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      {changed && (
        <form action={reorderPlan} className="mt-3 flex items-center justify-end gap-2">
          {Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {order.map((item) => (
            <input key={item.id} type="hidden" name="ids" value={item.id} />
          ))}
          <Button type="button" variant="ghost" onClick={() => setOrder(items)} className="h-10 sm:h-8">
            {t("cancel")}
          </Button>
          <Button type="submit" variant="outline" className="h-10 sm:h-8">
            {t("saveOrder")}
          </Button>
        </form>
      )}
    </>
  );
}

const addTrigger = (text: string) => (
  <Button variant="outline" className="h-10 px-3 sm:h-8">
    {text}
  </Button>
);
const editTrigger = (label: string, text: string) => (
  <Button variant="ghost" className="-ml-2.5 h-10 px-2.5 text-primary-ink sm:h-7" aria-label={label}>
    {text}
  </Button>
);

export function MealsEditor({ clientId, mode, meals }: { clientId: string; mode: TrackingMode; meals: Meal[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const [dayType, setDayType] = useState<DayType>("REST");
  const shown = meals.filter((m) => m.dayType === dayType);
  const portions = (meal: Meal) =>
    TARGET_FIELDS.PORTIONS.flatMap((f) => (meal[f] != null ? [t(`Targets.summary.${f}`, { value: format.number(meal[f]) })] : [])).join(" · ");

  const dialog = (meal?: Meal) => (
    <FormDialog
      trigger={meal ? editTrigger(t("Plan.editMeal", { name: meal.name }), t("Plan.edit")) : addTrigger(t("Plan.addMeal"))}
      title={meal ? t("Plan.mealEditTitle") : t("Plan.mealAddTitle")}
      save={saveMeal}
      remove={meal && deleteMeal}
    >
      {(invalid) => <MealFields clientId={clientId} mode={mode} meal={meal} dayType={dayType} invalid={invalid} />}
    </FormDialog>
  );

  return (
    <section aria-labelledby="plan-meals" className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 id="plan-meals" className="text-base font-semibold">
          {t("Plan.meals")}
        </h3>
        {dialog()}
      </div>
      <div role="group" aria-label={t("Plan.dayType")} className="mt-3 flex gap-2 overflow-x-auto">
        {DAY_TYPES.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === dayType}
            onClick={() => setDayType(d)}
            className="flex h-10 flex-none items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary-ink sm:h-8"
          >
            {t(`DayTypes.${d}`)}
            <span className="tabular-nums">{format.number(meals.filter((m) => m.dayType === d).length)}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("Plan.noMeals")}</p>
      ) : (
        <OrderedList
          key={`${dayType}:${shown.map((m) => m.id).join()}`}
          items={shown}
          label={(meal) => meal.name}
          hidden={{ clientId, kind: "meals", dayType }}
          render={(meal) => (
            <>
              <p className="text-sm">
                <span className="font-medium">{meal.name}</span>
                {meal.timeHint && <span className="text-muted-foreground"> · {meal.timeHint}</span>}
              </p>
              {mode === "PORTIONS" && portions(meal) && <p className="mt-0.5 text-sm tabular-nums">{portions(meal)}</p>}
              {meal.guidance && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{meal.guidance}</p>}
              {dialog(meal)}
            </>
          )}
        />
      )}
    </section>
  );
}

function MealFields({ clientId, mode, meal, dayType, invalid }: { clientId: string; mode: TrackingMode; meal?: Meal; dayType: DayType; invalid: (field: string) => boolean }) {
  const t = useTranslations();
  const id = useId();
  const error = (field: string) => (invalid(field) ? t("Plan.invalid") : undefined);
  return (
    <>
      <input type="hidden" name="clientId" value={clientId} />
      {meal && <input type="hidden" name="id" value={meal.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-name`} label={t("Plan.fields.name")} error={error("name")} className="sm:col-span-2">
          <Input id={`${id}-name`} name="name" required maxLength={100} defaultValue={meal?.name} aria-invalid={invalid("name")} aria-describedby={`${id}-name-note`} className="h-10" />
        </Field>
        <Field id={`${id}-time`} label={t("Plan.fields.timeHint")} error={error("timeHint")}>
          <Input id={`${id}-time`} name="timeHint" maxLength={50} defaultValue={meal?.timeHint ?? ""} aria-invalid={invalid("timeHint")} aria-describedby={`${id}-time-note`} className="h-10" />
        </Field>
        <Field id={`${id}-day`} label={t("Plan.dayType")}>
          <NativeSelect id={`${id}-day`} name="dayType" defaultValue={meal?.dayType ?? dayType} className="w-full [&_select]:h-10">
            {DAY_TYPES.map((d) => (
              <NativeSelectOption key={d} value={d}>
                {t(`DayTypes.${d}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field id={`${id}-guidance`} label={t("Plan.fields.guidance")} error={error("guidance")}>
        <Textarea id={`${id}-guidance`} name="guidance" maxLength={1000} rows={3} defaultValue={meal?.guidance ?? ""} aria-invalid={invalid("guidance")} aria-describedby={`${id}-guidance-note`} />
      </Field>
      {mode === "PORTIONS" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TARGET_FIELDS.PORTIONS.map((f) => (
            <Field key={f} id={`${id}-${f}`} label={t(`Targets.fields.${f}`)} error={error(f)}>
              <Input id={`${id}-${f}`} name={f} type="number" inputMode="decimal" min={0} max={10} step={0.5} defaultValue={meal?.[f] ?? ""} aria-invalid={invalid(f)} aria-describedby={`${id}-${f}-note`} className="h-10 tabular-nums" />
            </Field>
          ))}
        </div>
      )}
      <Field id={`${id}-note`} label={t("Plan.fields.note")} error={error("note")}>
        <Textarea id={`${id}-note`} name="note" maxLength={1000} rows={2} defaultValue={meal?.note ?? ""} aria-invalid={invalid("note")} aria-describedby={`${id}-note-note`} />
      </Field>
    </>
  );
}

export function RecommendationsEditor({ clientId, recommendations }: { clientId: string; recommendations: Recommendation[] }) {
  const t = useTranslations("Plan");
  const id = useId();
  const dialog = (item?: Recommendation) => (
    <FormDialog
      trigger={item ? editTrigger(t("editRecommendation", { title: item.title }), t("edit")) : addTrigger(t("addRecommendation"))}
      title={item ? t("recommendationEditTitle") : t("recommendationAddTitle")}
      save={saveRecommendation}
      remove={item && deleteRecommendation}
    >
      {(invalid) => (
        <>
          <input type="hidden" name="clientId" value={clientId} />
          {item && <input type="hidden" name="id" value={item.id} />}
          <Field id={`${id}-title`} label={t("fields.title")} error={invalid("title") ? t("invalid") : undefined}>
            <Input id={`${id}-title`} name="title" required maxLength={150} defaultValue={item?.title} aria-invalid={invalid("title")} aria-describedby={`${id}-title-note`} className="h-10" />
          </Field>
          <Field id={`${id}-text`} label={t("fields.text")} error={invalid("text") ? t("invalid") : undefined}>
            <Textarea id={`${id}-text`} name="text" maxLength={2000} rows={4} defaultValue={item?.text ?? ""} aria-invalid={invalid("text")} aria-describedby={`${id}-text-note`} />
          </Field>
        </>
      )}
    </FormDialog>
  );
  return (
    <section aria-labelledby="plan-recommendations" className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 id="plan-recommendations" className="text-base font-semibold">
          {t("recommendations")}
        </h3>
        {dialog()}
      </div>
      {recommendations.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("noRecommendations")}</p>
      ) : (
        <OrderedList
          key={recommendations.map((r) => r.id).join()}
          items={recommendations}
          label={(item) => item.title}
          hidden={{ clientId, kind: "recommendations" }}
          render={(item) => (
            <>
              <p className="text-sm font-medium">{item.title}</p>
              {item.text && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.text}</p>}
              {dialog(item)}
            </>
          )}
        />
      )}
    </section>
  );
}

export function SpecificsForm({ clientId, specifics }: { clientId: string; specifics: string | null }) {
  const t = useTranslations("Plan");
  const [state, save, pending] = useActionState(saveSpecifics, null);
  const [edited, setEdited] = useState(false);
  return (
    <section aria-labelledby="plan-specifics" className="rounded-lg border bg-card p-5">
      <h3 id="plan-specifics" className="text-base font-semibold">
        {t("specifics")}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("specificsText")}</p>
      <form
        action={(form) => {
          setEdited(false);
          save(form);
        }}
        onInput={() => setEdited(true)}
        className="mt-4 flex flex-col gap-3"
      >
        <input type="hidden" name="clientId" value={clientId} />
        <Textarea name="planSpecifics" aria-label={t("specifics")} maxLength={5000} rows={4} defaultValue={specifics ?? ""} />
        <div className="flex items-center justify-end gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            {state && !edited && !pending && t("saved")}
          </p>
          <Button type="submit" variant="outline" disabled={pending} className="h-10 px-4 sm:h-8">
            {t("save")}
          </Button>
        </div>
      </form>
    </section>
  );
}

export function CopyPlanDialog({ clientId, name, sources }: { clientId: string; name: string; sources: { id: string; name: string }[] }) {
  const t = useTranslations("Plan.copy");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" disabled={sources.length === 0} className="h-10 px-3 sm:h-8" />}>{t("open")}</DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-6 p-6 sm:max-w-md">
        <form
          action={async (form) => {
            await copyPlan(form);
            setOpen(false);
          }}
          className="flex flex-col gap-6"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{t("title", { name })}</DialogTitle>
            <DialogDescription>{t("text")}</DialogDescription>
          </DialogHeader>
          <Field id="copy-source" label={t("source")}>
            <NativeSelect id="copy-source" name="sourceId" required className="w-full [&_select]:h-10">
              {sources.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <DialogFooter className="-mx-6 -mb-6 px-6">
            <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
            <Button type="submit">{t("confirm")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
