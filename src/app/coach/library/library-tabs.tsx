"use client";

import { useTranslations } from "next-intl";
import { useSelectedLayoutSegment } from "next/navigation";
import { UnderlineTabs } from "@/components/underline-tabs";

// Library tabs: each lands with its feature (recipes, fueling and timeline templates, packages).
const TABS = [
  { key: "foods", segment: null },
  { key: "recipes", segment: "recipes" },
  { key: "fueling", segment: "fueling" },
] as const;

export function LibraryTabs() {
  const t = useTranslations("Library.tabs");
  const segment = useSelectedLayoutSegment();
  return (
    <UnderlineTabs
      label={t("label")}
      tabs={TABS.map((tab) => ({ href: `/coach/library${tab.segment ? `/${tab.segment}` : ""}`, label: t(tab.key), current: segment === tab.segment }))}
    />
  );
}
