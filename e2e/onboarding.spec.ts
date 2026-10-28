import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

// Its own coach (through the CLI, on the e2e database), so its notifications don't race the seeded coach's in other files.
test("a new client goes through onboarding: a reload keeps the step and the answers, finishing notifies the coach", async ({ page, browser }) => {
  test.slow(); // two browsers through every step
  const coachEmail = `onboarding-coach-${Date.now()}@test.cz`;
  execSync(`npm run coach:create -- --email ${coachEmail} --name "Olga Trenérová"`, { env: { ...process.env, DATABASE_URL: "file:./e2e.db" } });
  await logIn(page, coachEmail);
  await expect(page).toHaveURL("/coach");

  // The coach writes the welcome in settings.
  await page.goto("/coach/settings");
  const welcome = page.getByRole("region", { name: "Uvítání v onboardingu" });
  await welcome.getByLabel("Uvítací text").fill("Ahoj, těším se na spolupráci!");
  await welcome.getByRole("button", { name: "Uložit" }).click();
  await page.reload();
  await expect(welcome.getByLabel("Uvítací text")).toHaveValue("Ahoj, těším se na spolupráci!");

  await page.goto("/coach/clients");
  await page.getByRole("button", { name: "Pozvat klienta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Jméno klienta").fill("Ondřej Málek");
  await dialog.getByRole("button", { name: "Vytvořit odkaz" }).click();
  const link = await dialog.getByLabel("Odkaz pozvánky").inputValue();
  await dialog.getByRole("button", { name: "Hotovo" }).click();

  const client = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await client.goto(link);
  await client.getByLabel("E-mail").fill(`ondrej-${Date.now()}@test.cz`);
  await client.getByRole("button", { name: "Přijmout jako tento e-mail" }).click();
  await expect(client).toHaveURL("/onboarding");
  await expect(client.getByRole("list", { name: "Průběh nastavení" }).locator("[aria-current=step]")).toHaveText("Vítejte");
  await expect(client.getByRole("heading", { name: "Olga Trenérová vás vítá", level: 1 })).toBeVisible();
  await expect(client.getByText("Ahoj, těším se na spolupráci!")).toBeVisible();
  await client.getByRole("button", { name: "Pokračovat" }).click();

  // About you: the profile's sections plus the tracking style (the invite left it to the client).
  await expect(client.getByRole("heading", { name: "O vás", level: 1 })).toBeVisible();
  await expect(client.getByLabel("Jméno", { exact: true })).toHaveValue("Ondřej Málek");
  await client.getByLabel("Aktuální váha (kg)").fill("82");
  await client.getByLabel("Sezam").check();
  await client.getByRole("radio", { name: /^Porce/ }).check();
  await client.getByRole("button", { name: "Pokračovat" }).click();
  await expect(client.getByRole("heading", { name: "Váš cíl", level: 1 })).toBeVisible();

  // A reload stays on the step, and Back shows the saved answers.
  await client.reload();
  await expect(client.getByRole("heading", { name: "Váš cíl", level: 1 })).toBeVisible();
  await client.getByRole("button", { name: "Zpět" }).click();
  await expect(client.getByRole("heading", { name: "O vás", level: 1 })).toBeVisible();
  await expect(client.getByLabel("Aktuální váha (kg)")).toHaveValue("82");
  await expect(client.getByLabel("Sezam")).toBeChecked();
  await expect(client.getByRole("radio", { name: /^Porce/ })).toBeChecked();
  await client.getByRole("button", { name: "Pokračovat" }).click();

  await client.getByRole("radio", { name: "Zhubnout tuk" }).check();
  await client.getByLabel("Cílová váha (kg)").fill("76");
  await client.getByRole("button", { name: "Pokračovat" }).click();
  await expect(client.getByRole("heading", { name: "Hotovo", level: 1 })).toBeVisible();
  const summary = client.getByRole("region", { name: "Shrnutí" });
  await expect(summary).toContainText("Zhubnout tuk");
  await expect(summary.getByRole("definition").filter({ hasText: "76" })).toHaveCount(1);
  await expect(summary).toContainText("Sezam");
  await expect(summary).toContainText("Porce");
  await client.getByRole("button", { name: "Přejít do aplikace" }).click();
  await expect(client).toHaveURL("/app");
  await client.goto("/onboarding");
  await expect(client).toHaveURL("/app");

  await page.reload();
  await page.getByRole("link", { name: "Oznámení, 1 nepřečtené" }).click();
  await expect(page.getByRole("button", { name: "Nepřečtené: Úvodní nastavení dokončeno: Ondřej Málek" })).toBeVisible();
  // The client's preference shows on their profile, and became the mode (the invite set none).
  await page.goto("/coach/clients");
  await expect(page.getByRole("row", { name: /Ondřej Málek.*Porce/ })).toBeVisible();
  await page.getByRole("link", { name: "Ondřej Málek" }).click();
  await expect(page.getByText("Preferované sledování: Porce.")).toBeVisible();
});
