import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("Home");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2">
      <h1 className="text-3xl font-semibold">NutriCoach</h1>
      <p>{t("tagline")}</p>
    </main>
  );
}
