import type { Page } from "@playwright/test";

// Signs in with one click in the login page's dev login list (the e2e server is non-production).
export async function logIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: email }).click();
}
