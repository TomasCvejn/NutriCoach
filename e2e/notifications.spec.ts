import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("coach: the seeded unread notification shows on the bell until marked read", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");

  await page.getByRole("link", { name: "Oznámení, 1 nepřečtené" }).click();
  await expect(page).toHaveURL("/coach/notifications");
  await expect(page.getByRole("heading", { name: "Oznámení" })).toBeVisible();
  await expect(page.getByText("1 nepřečtené")).toBeVisible();
  await expect(page.getByRole("button", { name: /Úvodní nastavení dokončeno/ })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Nepřečtené: Úvodní nastavení dokončeno: Tereza Svobodová" })).toBeVisible();

  await page.getByRole("button", { name: "Označit vše jako přečtené" }).click();
  await expect(page.getByText("Vše přečteno")).toBeVisible();
  const bell = page.getByRole("link", { name: "Oznámení", exact: true });
  await expect(bell).toHaveText("");
  await page.reload();
  await expect(bell).toHaveText("");
});

test("client on a phone: the bell sits in the top bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "general@demo.cz");
  await page.getByRole("link", { name: "Oznámení", exact: true }).click();
  await expect(page).toHaveURL("/app/notifications");
  await expect(page.getByText("Zatím žádná oznámení.")).toBeVisible();
});
