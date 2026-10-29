import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("client adds a supplement of their own; the coach sees it flagged as added by the client", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "general@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.getByRole("button", { name: "Více" }).click();
  await page.getByRole("link", { name: "Doplňky" }).click();
  await expect(page.getByRole("heading", { name: "Doplňky", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Denně" })).toContainText("Omega-3"); // the coach's

  await page.getByRole("button", { name: "Přidat vlastní doplněk" }).click();
  const dialog = page.getByRole("dialog", { name: "Nový doplněk" });
  await dialog.getByLabel("Název").fill("Hořčík");
  await dialog.getByLabel("Dávka").fill("300 mg");
  await dialog.getByLabel("Načasování").fill("Večer");
  await dialog.getByRole("button", { name: "Uložit" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: "Hořčík" }).click();
  await expect(page.getByRole("heading", { name: "Hořčík", level: 1 })).toBeVisible();
  await expect(page.getByText("300 mg")).toBeVisible();

  const coach = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await logIn(coach, "coach@demo.cz");
  await expect(coach).toHaveURL("/coach");
  await coach.goto("/coach/clients");
  await coach.getByRole("link", { name: "Petr Novák" }).click();
  await coach.getByRole("navigation", { name: "Sekce klienta" }).getByRole("link", { name: "Doplňky" }).click();
  const daily = coach.getByRole("region", { name: "Denně" });
  await expect(daily.getByRole("listitem").filter({ hasText: "Hořčík" })).toContainText("Přidal klient");
  await expect(daily.getByRole("listitem").filter({ hasText: "Omega-3" })).not.toContainText("Přidal klient");
});
