import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("coach adds a food with a serving to the library and edits it; clients' foods are listed read-only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  await page.getByRole("navigation", { name: "Hlavní navigace" }).getByRole("link", { name: "Knihovna" }).click();
  await expect(page.getByRole("heading", { name: "Knihovna", level: 1 })).toBeVisible();
  const own = page.getByRole("region", { name: "Potraviny", exact: true });
  await expect(own.getByRole("row", { name: /Domácí granola/ })).toContainText("1 hrst = 40 g");

  await own.getByRole("button", { name: "Přidat potravinu" }).click();
  const dialog = page.getByRole("dialog", { name: "Nová potravina" });
  await dialog.getByLabel("Název", { exact: true }).fill("Pohanková kaše");
  await dialog.getByLabel("Energie (kcal)", { exact: true }).fill("110");
  await dialog.getByLabel("Bílkoviny (g)", { exact: true }).fill("4");
  await dialog.getByLabel("Sacharidy (g)", { exact: true }).fill("21");
  await dialog.getByLabel("Tuky (g)", { exact: true }).fill("1.2");
  await dialog.getByRole("button", { name: "Přidat porci" }).click();
  await dialog.getByLabel("Porce", { exact: true }).fill("1 miska");
  await dialog.getByLabel("Gramy").fill("300");
  await dialog.getByRole("button", { name: "Uložit" }).click();
  await expect(dialog).toBeHidden();
  const row = own.getByRole("row", { name: /Pohanková kaše/ });
  await expect(row).toContainText("1 miska = 300 g");
  await expect(row).toContainText("1,2");

  await row.getByRole("button", { name: "Upravit Pohanková kaše" }).click();
  const edit = page.getByRole("dialog", { name: "Upravit potravinu" });
  await expect(edit.getByLabel("Gramy")).toHaveValue("300");
  await edit.getByLabel("Energie (kcal)", { exact: true }).fill("115");
  await edit.getByRole("button", { name: "Uložit" }).click();
  await expect(edit).toBeHidden();
  await expect(row.getByRole("cell").nth(1)).toHaveText("115");

  await expect(page.getByRole("region", { name: "Potraviny klientů" })).toContainText("Lactose-free skyr");
  await expect(page.getByRole("region", { name: "Potraviny klientů" })).toContainText("Emma Walker");
});

test("coach writes a recipe from a library food and a text ingredient, sees the nutrition per portion, publishes it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  await page.goto("/coach/library");
  await page.getByRole("navigation", { name: "Sekce knihovny" }).getByRole("link", { name: "Recepty" }).click();
  await expect(page.getByRole("row", { name: /Ovesná kaše s banánem a borůvkami/ })).toContainText("neúplné"); // seeded, has a text ingredient
  await page.getByRole("link", { name: "Nový recept" }).click();

  await page.getByLabel("Název", { exact: true }).fill("Jogurtový dezert");
  await page.getByLabel("Počet porcí").fill("2");
  await page.getByLabel("Dezert").check();
  await page.getByRole("searchbox", { name: "Hledat ingredienci" }).fill("Řecký");
  await page.getByRole("button", { name: /Řecký jogurt bez laktózy/ }).click();
  await page.getByLabel("Gramy: Řecký jogurt bez laktózy").fill("300");
  await page.getByRole("button", { name: "Přidat ingredienci jako text" }).click();
  await page.getByLabel("Ingredience (text)", { exact: true }).fill("Vanilka");
  await page.getByRole("button", { name: "Přidat krok" }).click();
  await page.getByLabel("Krok 1", { exact: true }).fill("Jogurt prošlehejte s vanilkou.");

  const rail = page.getByRole("complementary", { name: "Na porci" });
  await expect(rail).toContainText("145,5 kcal"); // 300 g × 97 kcal / 100 g / 2 portions
  await expect(rail).toContainText("Výživa je neúplná");
  await page.getByRole("button", { name: "Uložit a publikovat" }).click();
  await expect(page).toHaveURL("/coach/library/recipes");
  const row = page.getByRole("row", { name: /Jogurtový dezert/ });
  await expect(row).toContainText("Publikováno");
  await expect(row).toContainText("146");
});
