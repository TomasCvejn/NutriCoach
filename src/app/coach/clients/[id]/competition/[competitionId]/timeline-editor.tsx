"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { applyTimelineTemplate, saveTimeline, saveTimelineTemplate } from "@/app/app/competition/actions";
import { PACKING_GROUPS, TIMELINE_PHASES } from "@/lib/enums";
import type { Timeline } from "@/lib/timeline";

type State = { invalid: string[] } | null | "saved";

// The coach's timeline editor: per phase the priorities and the tasks (one per line, with how many the client ticked), the
// packing list per group; apply a template from the library, or save this one as a template.
export function TimelineEditor({
  competitionId,
  timeline,
  templates,
}: {
  competitionId: string;
  timeline: Timeline;
  templates: { id: string; name: string }[];
}) {
  const t = useTranslations("Competition");
  const id = useId();
  const [state, save, saving] = useActionState(async (_: State, form: FormData): Promise<State> => (await saveTimeline(form)) ?? "saved", null);
  const [templateState, saveTemplate] = useActionState(async (_: State, form: FormData): Promise<State> => (await saveTimelineTemplate(form)) ?? "saved", null);
  const lines = (items: { text: string }[] = []) => items.map((i) => i.text).join("\n");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-lg border bg-card p-5">
        {templates.length > 0 && (
          <form action={applyTimelineTemplate} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="competitionId" value={competitionId} />
            <Field id={`${id}-template`} label={t("applyTemplate")} hint={t("applyHint")}>
              <NativeSelect id={`${id}-template`} name="templateId" aria-describedby={`${id}-template-note`} className="[&_select]:h-10 sm:[&_select]:h-8">
                {templates.map((template) => (
                  <NativeSelectOption key={template.id} value={template.id}>
                    {template.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Button type="submit" variant="outline" className="mb-6 h-10 sm:h-8">
              {t("apply")}
            </Button>
          </form>
        )}
        <form action={saveTemplate} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="competitionId" value={competitionId} />
          <Field
            id={`${id}-name`}
            label={t("saveAsTemplate")}
            hint={templateState === "saved" ? t("templateSaved") : t("templateHint")}
            error={templateState && templateState !== "saved" ? t("invalid.name") : undefined}
          >
            <Input id={`${id}-name`} name="name" maxLength={100} required aria-describedby={`${id}-name-note`} className="h-10 sm:h-8" />
          </Field>
          <Button type="submit" variant="outline" className="mb-6 h-10 sm:h-8">
            {t("saveTemplate")}
          </Button>
        </form>
      </div>

      <form action={save} className="flex flex-col gap-4">
        <input type="hidden" name="competitionId" value={competitionId} />
        {/* The fields start over when the stored timeline changes (saved, a template applied, a tick), so they show it. */}
        <div key={JSON.stringify(timeline)} className="flex flex-col gap-4">
          {TIMELINE_PHASES.map((phase) => {
            const tasks = timeline.phases[phase]?.tasks ?? [];
            return (
              <fieldset key={phase} className="rounded-lg border bg-card p-5">
                <legend className="float-left flex w-full flex-wrap items-baseline justify-between gap-2">
                  <span className="text-base font-semibold">{t(`phases.${phase}`)}</span>
                  {tasks.length > 0 && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {t("ticked", {
                        done: tasks.filter((x) => x.done).length,
                        all: tasks.length,
                      })}
                    </span>
                  )}
                </legend>
                <div className="clear-both grid gap-4 pt-3 md:grid-cols-2">
                  <Field id={`${id}-p-${phase}`} label={t("nutritionPriorities")}>
                    <Textarea
                      id={`${id}-p-${phase}`}
                      name={`priorities.${phase}`}
                      maxLength={4000}
                      rows={3}
                      defaultValue={timeline.phases[phase]?.priorities ?? ""}
                    />
                  </Field>
                  <Field id={`${id}-t-${phase}`} label={t("tasks")} hint={t("perLine")}>
                    <Textarea
                      id={`${id}-t-${phase}`}
                      name={`tasks.${phase}`}
                      maxLength={4000}
                      rows={3}
                      defaultValue={lines(tasks)}
                      aria-describedby={`${id}-t-${phase}-note`}
                    />
                  </Field>
                </div>
              </fieldset>
            );
          })}
          <fieldset className="rounded-lg border bg-card p-5">
            <legend className="float-left text-base font-semibold">{t("packing")}</legend>
            <div className="clear-both grid gap-4 pt-3 md:grid-cols-2">
              {PACKING_GROUPS.map((group) => (
                <Field key={group} id={`${id}-k-${group}`} label={t(`packingGroups.${group}`)} hint={t("perLine")}>
                  <Textarea
                    id={`${id}-k-${group}`}
                    name={`packing.${group}`}
                    maxLength={4000}
                    rows={3}
                    defaultValue={lines(timeline.packing.filter((p) => p.group === group))}
                    aria-describedby={`${id}-k-${group}-note`}
                  />
                </Field>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="h-10 px-5">
            {t("saveTimeline")}
          </Button>
          <p role="status" className="text-sm text-muted-foreground">
            {state === "saved" ? t("saved") : state ? t("invalidTimeline") : ""}
          </p>
        </div>
      </form>
    </div>
  );
}
