import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

// race@'s seeded marathon is 10 days out.
test("race@ sees her marathon in 10 days, its phase, and the half marathon's result", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "race@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.goto("/app/competition");
  const upcoming = page.getByRole("listitem").filter({ hasText: "Podzimní maraton Praha" });
  await expect(upcoming).toContainText("Za 10 dní");
  await expect(upcoming).toContainText("2 týdny do závodu");
  await expect(page.getByRole("listitem").filter({ hasText: "Půlmaraton Ústí" })).toContainText("1:39:12");
});

test("coach: the client's header counts down to the next competition, which the Competition tab lists", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  await page.goto("/coach/clients");
  await page.getByRole("link", { name: "Tereza Svobodová" }).click();
  await page.getByRole("link", { name: "Podzimní maraton Praha · za 10 dní" }).click();
  await expect(page).toHaveURL(/\/competition$/);
  await expect(page.getByRole("region", { name: "Nadcházející" })).toContainText("Podzimní maraton Praha");
});

test("race@ ticks a task of the current phase on her marathon's timeline; it stays ticked after a reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "race@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.goto("/app/competition");
  await page.getByRole("link", { name: "Podzimní maraton Praha" }).click();
  await expect(page.getByRole("heading", { name: "Podzimní maraton Praha", level: 1 })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Vyzkoušet závodní snídani před dlouhým tréninkem" })).toBeChecked(); // seeded, the phase before

  const task = page.getByRole("checkbox", { name: "Naplánovat jídla na závodní týden" });
  await expect(task).not.toBeChecked();
  await task.check();
  // The tick is saved behind the optimistic one: reload until the stored state shows.
  await expect(async () => {
    await page.reload();
    await expect(task).toBeChecked({ timeout: 1000 });
  }).toPass();
});
