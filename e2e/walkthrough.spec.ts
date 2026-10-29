import { expect, type Page, test } from "@playwright/test";
import { logIn } from "./dev-login";

// The demo walkthrough (00-overview.md): every nav entry as each demo user, and every client tab as the coach, renders
// without an error. Its own project after the rest: visiting reads threads and feedback, which other tests count unread.
test.use({ viewport: { width: 1440, height: 900 } }); // the sidebar holds every nav entry
test.describe.configure({ timeout: 180_000 });

// Console errors and uncaught exceptions of the page, collected for the whole test.
function errorsOf(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(`${page.url()}: ${message.text()}`));
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
  return errors;
}

const hrefs = (page: Page, selector: string) => page.locator(selector).evaluateAll((links) => links.map((a) => a.getAttribute("href")!));

async function visitAll(page: Page, paths: string[]) {
  for (const path of paths) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("main h1").first(), path).toBeVisible();
  }
}

for (const [email, home] of [["general@demo.cz", "/app"], ["sports@demo.cz", "/app"], ["race@demo.cz", "/app"], ["coach@demo.cz", "/coach"]] as const) {
  test(`${email} opens every nav entry without an error`, async ({ page }) => {
    const errors = errorsOf(page);
    await logIn(page, email);
    await expect(page).toHaveURL(home);
    const entries = await hrefs(page, "aside nav a");
    expect(entries.length).toBeGreaterThan(7);
    await visitAll(page, entries);
    expect(errors).toEqual([]);
  });
}

test("the coach opens every tab of each demo client without an error", async ({ page }) => {
  const errors = errorsOf(page);
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  for (const name of ["Petr Novák", "Emma Walker", "Tereza Svobodová"]) {
    await page.goto("/coach/clients");
    await page.getByRole("region", { name: "Seznam klientů" }).getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    const tabs = await hrefs(page, 'nav[aria-label="Sekce klienta"] a');
    expect(tabs).toHaveLength(9);
    await visitAll(page, [...tabs, `${tabs[0]}/nutrition/log`, `${tabs[0]}/profile`]);
  }
  expect(errors).toEqual([]);
});
