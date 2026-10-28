import { getTranslations } from "next-intl/server";
import { requireCoach } from "@/lib/auth";
import { LibraryTabs } from "./library-tabs";

// The coach's library (coach.md): what the coach builds once and uses for every client.
export default async function LibraryLayout({ children }: LayoutProps<"/coach/library">) {
  await requireCoach();
  const t = await getTranslations("Library");
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("lead")}</p>
      </header>
      <LibraryTabs />
      {children}
    </div>
  );
}
