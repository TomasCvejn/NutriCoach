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
  await coach.getByRole("link", { name: /Tereza Svobodová/ }).click();
  await expect(coach.getByRole("list", { name: "Zprávy v konverzaci" })).toContainText("těstoviny s rajčatovou omáčkou");
  await coach.getByLabel("Zpráva").fill("Ano, těstoviny jsou ideální. Omáčku spíš bez smetany.");
  await coach.getByRole("button", { name: "Odeslat" }).click();
  await expect(coach.getByRole("list", { name: "Zprávy v konverzaci" })).toContainText("Omáčku spíš bez smetany.");
  await expect(coach.getByLabel("Zpráva")).toHaveValue(""); // cleared after sending

  // No reload on the client's side: the open thread polls every 5 s.
  await expect(thread).toContainText("Omáčku spíš bez smetany.", { timeout: 12_000 });
});
