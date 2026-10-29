import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("the help renders in Czech for general@ and in English for sports@, the hand-portion guide open", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "general@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.getByRole("button", { name: "Více" }).click();
  await page.getByRole("link", { name: "Nápověda" }).click();
  await expect(page.getByRole("heading", { name: "Nápověda", level: 1 })).toBeVisible();
  await expect(page.getByText("Dlaň bílkovin")).toBeVisible();
  await page.getByText("Jak fungují check-iny").click();
  await expect(page.getByText(/Jednou týdně, v den, který určí trenér/)).toBeVisible();

  const sports = await (await browser.newContext()).newPage();
  await logIn(sports, "sports@demo.cz");
  await expect(sports).toHaveURL("/app");
  await sports.goto("/app/help");
  await expect(sports.getByRole("heading", { name: "Help", level: 1 })).toBeVisible();
  await expect(sports.getByText("Using the app")).toBeVisible();
});

test("the coach's help explains the overview", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  await page.getByRole("link", { name: "Nápověda" }).click();
  await expect(page.getByRole("heading", { name: "Nápověda", level: 1 })).toBeVisible();
  await expect(page.getByText(/Přehled – kdo potřebuje pozornost/)).toBeVisible();
});
