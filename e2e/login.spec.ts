import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("coach lands on /coach and can log out", async ({ page }) => {
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  await expect(page.getByRole("heading", { name: "Přehled" })).toBeVisible();

  await page.getByRole("button", { name: "Odhlásit se" }).click();
  await expect(page).toHaveURL("/login");
  await page.goto("/coach");
  await expect(page).toHaveURL("/login");
});

test("client lands on /app and opening /coach sends them back", async ({ page }) => {
  await logIn(page, "general@demo.cz");
  await expect(page).toHaveURL("/app");
  await expect(page.getByRole("heading", { name: "Dnes", level: 1 })).toBeVisible();

  await page.goto("/coach");
  await expect(page).toHaveURL("/app");
  // Signed in, the login page sends the user home.
  await page.goto("/login");
  await expect(page).toHaveURL("/app");
});

test("an inactive client is refused", async ({ page }) => {
  await logIn(page, "inactive@demo.cz");
  await expect(page).toHaveURL("/login?error=ACCOUNT_INACTIVE");
  await expect(page.getByRole("alert").filter({ hasText: "Účet je deaktivovaný. Obraťte se na svého trenéra." })).toBeVisible();
  await page.goto("/app");
  await expect(page).toHaveURL("/login");
});

test("a Google account without a user gets the no-account message", async ({ page }) => {
  // Where Better Auth's Google callback sends an unknown email (src/lib/auth.test.ts covers the callback itself).
  await page.goto("/login?error=signup_disabled");
  const message = "K tomuto účtu Google tu žádný účet není. Požádejte svého trenéra o pozvánku.";
  await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
});

test("language switch on the login page sets English", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
