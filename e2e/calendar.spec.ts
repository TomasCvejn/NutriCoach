import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

// The seeded call with race@ is two days out at 18:00 (Prague); her sessions are a day before and after it.
const inTwoDays = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date(Date.now() + 2 * 86_400_000));

test("race@'s week view shows her session and the call with her coach", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "race@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.goto(`/app/calendar?date=${inTwoDays}`);
  await expect(page.getByRole("heading", { name: "Kalendář", level: 1 })).toBeVisible();
  const week = page.getByRole("list", { name: "Dny týdne" });
  await expect(week.getByRole("link", { name: /^Hovor: 18:00 Hovor s trenérem/ })).toHaveAttribute("href", "https://meet.google.com/demo-race");
  await expect(week.getByRole("link", { name: /^Trénink: \d{2}:\d{2} Běh/ }).first()).toBeVisible();
  await expect(page.getByRole("list", { name: "Legenda" })).toContainText("Check-in");

  await page.getByRole("link", { name: "Měsíc" }).click();
  await expect(page.getByRole("list", { name: "Dny měsíce" })).toBeVisible();
});

test("coach's calendar shows every client; filtering to race@ leaves only hers", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  await page.goto(`/coach/calendar?date=${inTwoDays}`);
  const week = page.getByRole("list", { name: "Dny týdne" });
  await expect(week.getByText("· Tereza Svobodová").first()).toBeVisible();

  await page.getByLabel("Klient").selectOption({ label: "Tereza Svobodová" });
  await page.getByRole("button", { name: "Zobrazit" }).click();
  await expect(page).toHaveURL(/client=/);
  await expect(week.getByRole("link", { name: /^Hovor: 18:00 Hovor · Tereza Svobodová/ })).toBeVisible();
  await expect(week.getByText("Emma Walker")).toHaveCount(0);
  await expect(week.getByText("Petr Novák")).toHaveCount(0);
  // The filter stays when moving to the next week.
  await page.getByRole("link", { name: "Další" }).click();
  await expect(page).toHaveURL(/client=/);
});
