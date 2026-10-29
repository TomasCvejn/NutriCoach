"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UnderlineTabs } from "@/components/underline-tabs";
import { TRACKING_MODES, type TrackingMode } from "@/lib/enums";
import { changeTrackingMode } from "./actions";

// The client's tabs: each one lands with its feature, and the coach sees all of them for every client.
// The segment is the tab's route under /coach/clients/[id] (null = Overview).
const TABS = [
  { key: "overview", segment: null },
  { key: "nutrition", segment: "nutrition" },
  { key: "progress", segment: "progress" },
  { key: "checkIns", segment: "check-ins" },
  { key: "notes", segment: "notes" },
] as const;

export function ClientTabs({ clientId }: { clientId: string }) {
  const t = useTranslations("ClientDashboard.tabs");
  const segment = useSelectedLayoutSegment();
  return (
    <UnderlineTabs
      label={t("label")}
      tabs={TABS.map((tab) => ({ href: `/coach/clients/${clientId}${tab.segment ? `/${tab.segment}` : ""}`, label: t(tab.key), current: segment === tab.segment }))}
    />
  );
}

// Inside the Nutrition tab: the plan and targets (segment null) and the daily log, as chips under the client's tabs.
const NUTRITION_VIEWS = [
  { key: "plan", segment: null },
  { key: "log", segment: "log" },
] as const;

export function NutritionNav({ clientId }: { clientId: string }) {
  const t = useTranslations("ClientDashboard.nutritionViews");
  const segment = useSelectedLayoutSegment();
  return (
    <nav aria-label={t("label")} className="flex gap-2 overflow-x-auto">
      {NUTRITION_VIEWS.map((view) => (
        <Link
          key={view.key}
          href={`/coach/clients/${clientId}/nutrition${view.segment ? `/${view.segment}` : ""}`}
          aria-current={segment === view.segment ? "page" : undefined}
          className="flex h-10 flex-none items-center rounded-full border bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-ink sm:h-8"
        >
          {t(view.key)}
        </Link>
      ))}
    </nav>
  );
}

export function TrackingModeDialog({ clientId, name, mode }: { clientId: string; name: string; mode: TrackingMode }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="h-10 px-3 sm:h-8" />}>{t("ClientDashboard.changeMode.open")}</DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-6 p-6 sm:max-w-md">
        <form
          action={async (form) => {
            await changeTrackingMode(form);
            setOpen(false);
          }}
          className="flex flex-col gap-6"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{t("ClientDashboard.changeMode.title", { name })}</DialogTitle>
            <DialogDescription>{t("ClientDashboard.changeMode.text")}</DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label={t("ClientDashboard.changeMode.label")} className="flex flex-col gap-3">
            {TRACKING_MODES.map((m) => (
              <label
                key={m}
                className="flex cursor-pointer gap-3 rounded-md border p-4 transition-colors hover:bg-muted/60 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input type="radio" name="trackingMode" value={m} defaultChecked={m === mode} className="mt-0.5 size-4 flex-none accent-primary outline-none" />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{t(`TrackingModes.${m}`)}</span>
                  <span className="text-sm text-muted-foreground">{t(`ClientDashboard.changeMode.modes.${m}`)}</span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6">
            <DialogClose render={<Button variant="outline" />}>{t("ClientDashboard.changeMode.cancel")}</DialogClose>
            <Button type="submit">{t("ClientDashboard.changeMode.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
