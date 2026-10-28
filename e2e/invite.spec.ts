import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("coach invites a client, who accepts in another browser and starts onboarding",async ({ page, browser }) => {
  await logIn(page, "coach@demo.cz");
  await page.getByRole("link", { name: "Klienti", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Klienti", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Pozvat klienta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Jméno klienta").fill("Klára Dvořáková");
  await dialog.getByLabel("E-mail (nepovinný)").fill("klara@test.cz");
  await dialog.getByLabel("Sledování").selectOption("PORTIONS");
  await dialog.getByRole("button", { name: "Vytvořit odkaz" }).click();
  const link = await dialog.getByLabel("Odkaz pozvánky").inputValue();
  expect(link).toMatch(/^http:\/\/localhost:3100\/invite\/[\w-]{43}$/);
  await dialog.getByRole("button", { name: "Hotovo" }).click();
  const pending = page.getByRole("region", { name: "Čekající pozvánky" });
  await expect(pending.getByText("Klára Dvořáková")).toBeVisible();
  await expect(pending.getByText("Sledování: Porce")).toBeVisible();

  // A fresh browser: nobody signed in.
  const client = await (await browser.newContext()).newPage();
  await client.goto(link);
  await expect(client.getByRole("heading", { name: "Jana Horáková vás zve do NutriCoach" })).toBeVisible();
  await expect(client.getByLabel("Vaše časové pásmo")).not.toHaveValue("");
  await client.getByLabel("E-mail").fill("someone@test.cz");
  await client.getByRole("button", { name: "Přijmout jako tento e-mail" }).click();
  const mismatch = "Pozvánka patří jinému e-mailu. Pokračujte účtem Google, na který vás trenér pozval.";
  await expect(client.getByRole("alert").filter({ hasText: mismatch })).toBeVisible();

  await client.getByLabel("E-mail").fill("klara@test.cz");
  await client.getByRole("button", { name: "Přijmout jako tento e-mail" }).click();
  // A new client starts with onboarding (e2e/onboarding.spec.ts).
  await expect(client).toHaveURL("/onboarding");
  await expect(client.getByRole("heading", { name: "Jana Horáková vás vítá", level: 1 })).toBeVisible();

  await client.goto(link);
  await expect(client.getByRole("heading", { name: "Pozvánka už byla použita" })).toBeVisible();

  await page.reload();
  await expect(pending.getByText("Klára Dvořáková")).toHaveCount(0);
  await expect(page.getByRole("row", { name: /Klára Dvořáková.*Porce/ })).toBeVisible();
});

test("coach revokes a pending invite and its link stops working", async ({ page }) => {
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  await page.goto("/coach/clients");
  const pending = page.getByRole("region", { name: "Čekající pozvánky" });
  await expect(pending.getByText("Martin Beneš")).toBeVisible();
  await pending.getByRole("button", { name: "Zrušit pozvánku pro Martin Beneš" }).click();
  await expect(pending.getByText("Martin Beneš")).toHaveCount(0);

  await page.goto("/invite/demo-invite");
  await expect(page.getByRole("heading", { name: "Pozvánka byla zrušena" })).toBeVisible();
});
