import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

// Coach → race@ only: other specs count the coach's bell, and race@'s bell nobody does.
test("coach writes to race@: the message arrives in her open thread within a poll; she sees the seeded unread one was read", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "race@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.getByRole("navigation", { name: "Hlavní navigace" }).getByRole("link", { name: "Zprávy" }).click();
  const thread = page.getByRole("list", { name: "Zprávy v konverzaci" });
  await expect(thread).toContainText("Mám zkusit jiné gely?");

  const coach = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await logIn(coach, "coach@demo.cz");
  await expect(coach).toHaveURL("/coach");
  await coach.getByRole("link", { name: /^Zprávy/ }).first().click();
  await expect(coach).toHaveURL("/coach/messages");
  await coach.getByRole("navigation", { name: "Konverzace s klienty" }).getByRole("link", { name: /Tereza Svobodová/ }).click();
  await expect(coach.getByRole("list", { name: "Zprávy v konverzaci" })).toContainText("těstoviny s rajčatovou omáčkou");
  await coach.getByLabel("Zpráva").fill("Ano, těstoviny jsou ideální. Omáčku spíš bez smetany.");
  await coach.getByRole("button", { name: "Odeslat" }).click();
  await expect(coach.getByRole("list", { name: "Zprávy v konverzaci" })).toContainText("Omáčku spíš bez smetany.");
  await expect(coach.getByLabel("Zpráva")).toHaveValue(""); // cleared after sending

  // No reload on the client's side: the open thread polls every 5 s.
  await expect(thread).toContainText("Omáčku spíš bez smetany.", { timeout: 12_000 });
});

test("coach comments on race@'s day; she sees it in that day and in the thread, which links back to the day", async ({ page, browser }) => {
  const coach = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await logIn(coach, "coach@demo.cz");
  await expect(coach).toHaveURL("/coach");
  await coach.goto("/coach/clients");
  await coach.getByRole("link", { name: "Tereza Svobodová", exact: true }).click();
  await coach.getByRole("navigation", { name: "Sekce klienta" }).getByRole("link", { name: "Výživa" }).click();
  await coach.getByRole("link", { name: "Denní záznam" }).click();
  const comments = coach.getByRole("region", { name: "Komentáře" });
  await comments.getByLabel("Komentář").fill("Výborně rozložené sacharidy přes den.");
  await comments.getByRole("button", { name: "Odeslat" }).click();
  await expect(comments.getByRole("listitem")).toContainText("Výborně rozložené sacharidy přes den.");

  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "race@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.goto("/app/nutrition"); // today, the day the coach commented
  await expect(page.getByRole("region", { name: "Komentáře" })).toContainText("Výborně rozložené sacharidy přes den.");
  await page.goto("/app/messages");
  const comment = page.getByRole("list", { name: "Zprávy v konverzaci" }).getByRole("listitem").filter({ hasText: "Výborně rozložené" });
  await comment.getByRole("link", { name: /^Komentář k výživě/ }).click();
  await expect(page).toHaveURL(/\/app\/nutrition\?date=\d{4}-\d{2}-\d{2}$/);
});
