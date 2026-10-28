import { getTranslations } from "next-intl/server";
import Link from "next/link";

// A plan meal's recipe options as links to the client's recipe screen (plain names for the coach, who has the library).
export async function RecipeLinks({ ids, recipes, viewer = "CLIENT" }: { ids: string[]; recipes: { id: string; name: string }[]; viewer?: "CLIENT" | "COACH" }) {
  const t = await getTranslations("ClientPlan");
  const shown = ids.flatMap((id) => recipes.filter((r) => r.id === id));
  if (shown.length === 0) return null;
  return (
    <p className="mt-1 text-sm">
      <span className="text-muted-foreground">{t("recipes")}: </span>
      {shown.map((r, i) => (
        <span key={r.id}>
          {i > 0 && ", "}
          {viewer === "CLIENT" ? (
            <Link href={`/app/recipes/${r.id}`} className="font-medium text-primary-ink hover:underline">
              {r.name}
            </Link>
          ) : (
            r.name
          )}
        </span>
      ))}
    </p>
  );
}
