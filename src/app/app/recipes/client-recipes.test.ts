import { expect, test, vi } from "vitest";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirectsTo, signIn, uniqueEmail } from "@/test/auth";
import ClientRecipe from "./[id]/page";
import { toggleSaved } from "./actions";
import { publishedRecipes } from "./data";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

async function setup() {
  const coach = await createUser({ email: uniqueEmail("recipes-coach"), name: "Coach", role: "COACH" });
  const other = await createUser({ email: uniqueEmail("recipes-other"), name: "Other", role: "COACH" });
  const user = await createUser({ email: uniqueEmail("recipes-client"), name: "Klient", role: "CLIENT", client: { create: { coachId: coach.id } } });
  const make = (coachId: string, name: string, status: string) => db.recipe.create({ data: { coachId, name, status } });
  const recipes = { published: await make(coach.id, "Published", "PUBLISHED"), draft: await make(coach.id, "Draft", "DRAFT"), archived: await make(coach.id, "Archived", "ARCHIVED"), foreign: await make(other.id, "Foreign", "PUBLISHED") };
  request.cookie = await signIn(user.email);
  return { coach, user, client: await db.client.findUniqueOrThrow({ where: { userId: user.id } }), recipes };
}
const page = (id: string) => ClientRecipe({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });

test("a client sees only their coach's published recipes", async () => {
  const { coach, recipes } = await setup();
  expect((await publishedRecipes(coach.id)).map((r) => r.name)).toEqual(["Published"]);
  for (const r of [recipes.draft, recipes.archived, recipes.foreign]) await expect(page(r.id)).rejects.toMatchObject(notFound);
});

test("the heart saves and unsaves; only published recipes of the client's coach; a coach can't", async () => {
  const { coach, client, recipes } = await setup();
  const saved = () => db.savedRecipe.findMany({ where: { clientId: client.id } });
  await toggleSaved(form({ recipeId: recipes.published.id }));
  expect(await saved()).toMatchObject([{ recipeId: recipes.published.id }]);
  await toggleSaved(form({ recipeId: recipes.published.id }));
  expect(await saved()).toEqual([]);
  for (const r of [recipes.draft, recipes.foreign]) await expect(toggleSaved(form({ recipeId: r.id }))).rejects.toMatchObject(notFound);
  request.cookie = await signIn(coach.email);
  await expect(toggleSaved(form({ recipeId: recipes.published.id }))).rejects.toMatchObject(redirectsTo("/coach"));
  expect(await saved()).toEqual([]);
});
