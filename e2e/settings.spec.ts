import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

// Runs before every other spec (its own project in playwright.config.ts), so the moment race@ is in English can't meet
// another spec reading race@'s Czech UI; it switches back at the end.
test("client on a phone switches to English: the UI is English at once and after reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "race@demo.cz");
  await page.getByRole("button", { name: "Více" }).click();
  await page.getByRole("link", { name: "Nastavení" }).click();
  await expect(page).toHaveURL("/app/settings");
  await expect(page.getByLabel("Časové pásmo", { exact: true })).toHaveValue("Europe/Prague");

  await page.getByLabel("Jazyk", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Uložit" }).click();
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Today" })).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("en");
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue("Europe/Prague");

  await page.getByLabel("Language", { exact: true }).selectOption("cs");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Nastavení", level: 1 })).toBeVisible();
});

test("coach opens settings from the sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  await page.getByRole("link", { name: "Nastavení" }).click();
  await expect(page).toHaveURL("/coach/settings");
  await expect(page.getByRole("heading", { name: "Jazyk a časové pásmo" })).toBeVisible();
});
