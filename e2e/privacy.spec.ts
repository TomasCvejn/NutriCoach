import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("logged out, the privacy policy renders from the login page, in Czech and in English", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Zásady ochrany osobních údajů" }).click();
  await expect(page).toHaveURL("/privacy");
  await expect(page.getByRole("heading", { name: "Zásady ochrany osobních údajů", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vaše práva", level: 2 })).toBeVisible();
  await context.addCookies([{ name: "locale", value: "en", url: page.url() }]); // the language the login page remembers
  await page.reload();
  await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();
});

test("the account section shows the Google account's name and email", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "general@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.goto("/app/settings");
  const account = page.getByRole("region", { name: "Účet a soukromí" });
  await expect(account).toContainText("general@demo.cz");
  await expect(account).toContainText("Petr Novák");
  await expect(account.getByRole("link", { name: "Zásady ochrany osobních údajů" })).toHaveAttribute("href", "/privacy");
});

test("a client downloads their data as JSON; deleting the account doesn't go through without the exact word", async ({ page }) => {
  await logIn(page, "general@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.goto("/app/settings");
  const data = page.getByRole("region", { name: "Vaše data" });
  const [download] = await Promise.all([page.waitForEvent("download"), data.getByRole("link", { name: "Stáhnout moje data" }).click()]);
  expect(download.suggestedFilename()).toBe("nutricoach-data.json");
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(exported.account.email).toBe("general@demo.cz");
  expect(exported.portionLogs.length).toBeGreaterThan(0); // general@ counts portions

  const word = data.getByLabel("Pro potvrzení napište SMAZAT");
  await word.fill("smazat");
  await data.getByRole("button", { name: "Smazat účet natrvalo" }).click();
  expect(await word.evaluate((input: HTMLInputElement) => input.validity.patternMismatch)).toBe(true);
  await expect(page).toHaveURL("/app/settings");
});
