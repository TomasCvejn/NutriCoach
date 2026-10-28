import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

// race@'s mode is switched below, so race@'s home widget is checked here first.
test("race@'s home shows today's goals in calories", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "race@demo.cz");
  await expect(page).toHaveURL("/app");
  await expect(page.getByRole("region", { name: "Dnešní cíle" }).getByRole("meter", { name: "Energie" })).toHaveAttribute("aria-valuetext", "0 / 2\u00a0100 kcal"); // cs groups thousands with U+00A0
});

test("coach opens race@'s dashboard and switches the tracking mode to PORTIONS and back", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  await page.goto("/coach/clients");
  await page.getByRole("link", { name: "Tereza Svobodová" }).click();
  await expect(page.getByRole("heading", { name: "Tereza Svobodová", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sekce klienta" }).getByRole("link", { name: "Přehled" })).toHaveAttribute("aria-current", "page");

  const goals = page.getByRole("region", { name: "Cíle", exact: true });
  await expect(goals).toContainText("Příprava na závod");
  await expect(goals).toContainText("Maraton pod 3:30");
  const profile = page.getByRole("region", { name: "Profil" });
  await expect(profile).toContainText("Běh (maraton) · Amatérský závodní · 6× týdně · 70 min");
  await expect(profile).toContainText("Vegetariánská");

  for (const mode of ["Porce", "Kalorie"]) {
    await page.getByRole("button", { name: "Změnit sledování" }).click();
    const dialog = page.getByRole("dialog", { name: "Sledování pro Tereza Svobodová" });
    await dialog.getByRole("radio", { name: new RegExp(`^${mode}`) }).check();
    await dialog.getByRole("button", { name: "Uložit" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(`Sledování: ${mode} · Příprava na závod`)).toBeVisible();
  }

  await profile.getByRole("link", { name: "Upravit profil" }).click();
  await expect(page).toHaveURL(/\/coach\/clients\/\w+\/profile$/);
  await expect(page.getByRole("heading", { name: "Tereza Svobodová", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Trénink a sport" }).getByLabel("Sport(y)")).toHaveValue("Běh (maraton)");
});
