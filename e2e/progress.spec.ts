import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("client on a phone adds a weigh-in: the table shows the change against the previous one; the chart has its table", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "general@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.getByRole("button", { name: "Více" }).click();
  await page.getByRole("link", { name: "Pokrok" }).click();
  await expect(page.getByRole("heading", { name: "Pokrok", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Přidat měření" }).click();
  const dialog = page.getByRole("dialog", { name: "Nové měření" });
  await dialog.getByRole("button", { name: "Uložit" }).click(); // nothing measured
  await expect(dialog.getByRole("alert")).toHaveText("Zadejte aspoň jednu hodnotu.");
  await dialog.getByLabel("Hmotnost (kg)").fill("93.9");
  await dialog.getByLabel("Pas (cm)").fill("101");
  await dialog.getByRole("button", { name: "Uložit" }).click();
  await expect(dialog).toBeHidden();

  const latest = page.getByRole("table", { name: "Všechna měření" }).getByRole("row").nth(1); // after the header
  await expect(latest.getByRole("cell").first()).toHaveText("93,9změna -0,6"); // 94.5 → 93.9 (the sr-only "change" reads first)
  await expect(latest.getByRole("cell").nth(1)).toHaveText("101změna -1,5");

  const weight = page.getByRole("region", { name: "Hmotnost" });
  await weight.getByRole("button", { name: "Tabulka" }).click();
  await expect(weight.getByRole("row").last()).toHaveText(/93,9\s?kg/);
});
