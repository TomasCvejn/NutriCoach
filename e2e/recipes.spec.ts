import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("a gluten-allergic client sees the warning on a recipe with gluten, scales portions and saves it", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "general@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.getByRole("button", { name: "Více" }).click();
  await page.getByRole("link", { name: "Recepty" }).click();
  await expect(page.getByRole("heading", { name: "Recepty", level: 1 })).toBeVisible();
  await expect(page.getByText("Pre-race rice cakes")).toHaveCount(0); // a draft

  await page.getByRole("searchbox", { name: "Hledat recept" }).fill("boruvky"); // by ingredient, without diacritics
  await page.getByRole("button", { name: "Hledat" }).click();
  await page.getByRole("link", { name: "Ovesná kaše s banánem a borůvkami" }).click();
  const warning = page.getByRole("region", { name: "Pozor, tento recept se k vám nemusí hodit" });
  await expect(warning).toContainText("Obsahuje: Lepek");

  const ingredients = page.getByRole("region", { name: "Ingredience" });
  await expect(ingredients.getByRole("listitem").first()).toContainText("60 g");
  await ingredients.getByRole("button", { name: "O porci více" }).click();
  await expect(ingredients.getByRole("listitem").first()).toContainText("120 g");

  await page.getByRole("button", { name: "Uložit Ovesná kaše s banánem a borůvkami" }).click();
  await expect(page.getByRole("button", { name: "Odebrat z uložených: Ovesná kaše s banánem a borůvkami" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/app/recipes?saved=1");
  await expect(page.getByRole("link", { name: "Ovesná kaše s banánem a borůvkami" })).toBeVisible();
  await page.getByRole("button", { name: "Odebrat z uložených: Ovesná kaše s banánem a borůvkami" }).click();
  await expect(page.getByText("Zatím nemáte uložené recepty.")).toBeVisible();

  const race = await (await browser.newContext()).newPage(); // a vegetarian: the salmon bowl isn't flagged vegetarian
  await logIn(race, "race@demo.cz");
  await expect(race).toHaveURL("/app");
  await race.goto("/app/recipes");
  await race.getByRole("link", { name: "Rýžový bowl s lososem" }).click();
  await expect(race.getByRole("region", { name: "Pozor, tento recept se k vám nemusí hodit" })).toContainText("Recept není vegetariánský.");
});
