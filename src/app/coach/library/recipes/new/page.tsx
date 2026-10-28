import { getTranslations } from "next-intl/server";
import { requireCoach } from "@/lib/auth";
import { RecipeEditor } from "../recipe-editor";

export default async function NewRecipe() {
  await requireCoach();
  const t = await getTranslations("Recipes");
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("newTitle")}</h2>
      <RecipeEditor foods={{}} />
    </div>
  );
}
