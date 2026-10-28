"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishedRecipe } from "./data";

// The heart on a recipe: save it to the client's "Saved", or take it out. Only their coach's published recipes.
export async function toggleSaved(form: FormData) {
  const { client } = await requireClient();
  const recipe = await publishedRecipe(client.coachId, z.string().parse(form.get("recipeId")));
  const key = { clientId_recipeId: { clientId: client.id, recipeId: recipe.id } };
  if (await db.savedRecipe.findUnique({ where: key })) await db.savedRecipe.delete({ where: key });
  else await db.savedRecipe.create({ data: { clientId: client.id, recipeId: recipe.id } });
  revalidatePath("/app/recipes", "layout");
}
