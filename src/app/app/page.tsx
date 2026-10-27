import { getTranslations } from "next-intl/server";

export default async function ClientHome() {
  const t = await getTranslations("ClientHome");
  return <h1 className="text-2xl font-bold tracking-tight sm:text-title">{t("title")}</h1>;
}
