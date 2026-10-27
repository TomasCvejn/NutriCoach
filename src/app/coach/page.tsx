import { getTranslations } from "next-intl/server";

export default async function CoachHome() {
  const t = await getTranslations("CoachHome");
  return <h1 className="text-2xl font-bold tracking-tight sm:text-title">{t("title")}</h1>;
}
