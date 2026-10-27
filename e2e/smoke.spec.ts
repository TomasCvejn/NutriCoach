import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("logged out, / shows the login in Czech by default", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { name: "Přihlášení" })).toBeVisible();
  await expect(page.getByText("Výživový koučink pro trenéry a jejich klienty")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
});

test("a signed-in user's locale beats the cookie", async ({ page }) => {
  await logIn(page, "sports@demo.cz"); // en user, the login page itself is cs
  await expect(page).toHaveURL("/app");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("locale cookie en renders English", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "locale", value: "en", url: baseURL! }]);
  await page.goto("/login");
  await expect(page.getByText("Nutrition coaching for coaches and their clients")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
