import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

// Coach → race@ (her bell nobody counts). Both are in Prague, so 18:00 for the coach is 18:00 for her.
test("coach schedules a call with race@ from her header; her home's next 7 days shows it at that time", async ({ page, browser }) => {
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date(Date.now() + 86_400_000));
  const coach = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await logIn(coach, "coach@demo.cz");
  await expect(coach).toHaveURL("/coach");
  await coach.goto("/coach/clients");
  await coach.getByRole("link", { name: "Tereza Svobodová", exact: true }).click();
  await coach.getByRole("button", { name: "Naplánovat hovor" }).click();
  const dialog = coach.getByRole("dialog", { name: "Nový hovor" });
  await dialog.getByLabel("Kdy").fill(`${tomorrow}T18:00`);
  await dialog.getByLabel("Odkaz na schůzku").fill("javascript:alert(1)");
  await dialog.getByRole("button", { name: "Uložit" }).click();
  await expect(dialog.getByText("Jen odkaz začínající https:// nebo http://.")).toBeVisible();
  await dialog.getByLabel("Odkaz na schůzku").fill("https://meet.example.com/race");
  await dialog.getByLabel("Program").fill("Plán závodního dne");
  await dialog.getByRole("button", { name: "Uložit" }).click();
  await expect(dialog).toBeHidden();
  await expect(coach.getByRole("region", { name: "Nadcházející hovory" })).toContainText("Plán závodního dne");

  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "race@demo.cz");
  await expect(page).toHaveURL("/app");
  // The seeded call is there too; this one is the one with this link.
  const call = page.getByRole("region", { name: "Příštích 7 dní" }).getByRole("listitem").filter({ has: page.locator('a[href="https://meet.example.com/race"]') });
  await expect(call).toContainText("18:00");
  await expect(call.getByRole("link", { name: "Hovor s trenérem" })).toBeVisible();
});
