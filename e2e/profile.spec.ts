import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("client ticks an allergen: still ticked after reload, and the coach sees it", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "general@demo.cz");
  await page.getByRole("button", { name: "Více" }).click();
  await page.getByRole("link", { name: "Profil" }).click();
  await expect(page).toHaveURL("/app/profile");

  const dietary = page.getByRole("region", { name: "Strava a alergie" });
  await expect(dietary.getByLabel("Typ stravy")).toHaveValue("OMNIVORE");
  await dietary.getByLabel("Sezam").check();
  await dietary.getByRole("button", { name: "Uložit" }).click();
  await expect(dietary.getByRole("status")).toHaveText("Uloženo");
  await expect(dietary.getByLabel("Typ stravy")).toHaveValue("OMNIVORE"); // the form reset after saving keeps the saved values
  await page.reload();
  await expect(dietary.getByLabel("Sezam")).toBeChecked();
  await expect(dietary.getByLabel("Typ stravy")).toHaveValue("OMNIVORE");

  const coach = await browser.newPage();
  await logIn(coach, "coach@demo.cz");
  await expect(coach).toHaveURL("/coach");
  await coach.goto("/coach/clients");
  await coach.getByRole("link", { name: "Petr Novák" }).click();
  await expect(coach.getByRole("heading", { name: "Petr Novák", level: 1 })).toBeVisible();
  await expect(coach.getByRole("region", { name: "Profil" }).getByText("Sezam")).toBeVisible();
  await coach.getByRole("link", { name: "Upravit profil" }).click();
  await expect(coach.getByRole("region", { name: "Strava a alergie" }).getByLabel("Sezam")).toBeChecked();
});
