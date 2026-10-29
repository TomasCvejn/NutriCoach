import { getTranslations } from "next-intl/server";
import { deleteTimelineTemplate } from "@/app/app/competition/actions";
import { Button } from "@/components/ui/button";
import { requireCoach } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TimelineContent } from "@/lib/timeline";

// Library → Timelines: the coach's competition timeline templates, saved from a competition's plan and applied there.
export default async function LibraryTimelines() {
  const coach = await requireCoach();
  const [t, templates] = await Promise.all([getTranslations("Competition"), db.timelineTemplate.findMany({ where: { coachId: coach.id }, orderBy: { name: "asc" } })]);

  return (
    <section aria-labelledby="timelines-title" className="flex flex-col gap-4">
      <div>
        <h2 id="timelines-title" className="text-lg font-semibold">
          {t("templates")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("templatesLead")}</p>
      </div>
      {templates.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{t("noTemplates")}</p>
      ) : (
        <ul className="max-w-3xl">
          {templates.map((template) => {
            const content = template.content as TimelineContent;
            const tasks = Object.values(content.phases).reduce((sum, p) => sum + p.tasks.length, 0);
            return (
              <li key={template.id} className="flex items-center justify-between gap-4 border-t border-rule py-3">
                <span>
                  <span className="block font-medium">{template.name}</span>
                  <span className="text-xs text-muted-foreground">{t("templateSummary", { phases: Object.keys(content.phases).length, tasks, packing: content.packing.length })}</span>
                </span>
                <form action={deleteTimelineTemplate}>
                  <input type="hidden" name="id" value={template.id} />
                  <Button type="submit" variant="ghost" className="h-10 sm:h-8" aria-label={t("deleteTemplate", { name: template.name })}>
                    {t("delete")}
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
