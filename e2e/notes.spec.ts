import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("coach adds a pinned decision from the header: it tops the Notes tab, and the filter shows decisions only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  await page.goto("/coach/clients");
  await page.getByRole("link", { name: "Emma Walker" }).click();
  await expect(page.getByRole("heading", { name: "Emma Walker", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Přidat poznámku" }).click();
  const dialog = page.getByRole("dialog", { name: "Nová poznámka" });
  await dialog.getByRole("radio", { name: "Rozhodnutí" }).check();
  await dialog.getByLabel("Text").fill("Před závodem sacharidy 8 g/kg.");
  await dialog.getByLabel("Připnout nahoru").check();
  await dialog.getByRole("button", { name: "Uložit" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("navigation", { name: "Sekce klienta" }).getByRole("link", { name: "Poznámky" }).click();
  const pinned = page.getByRole("region", { name: "Připnuté" });
  await expect(pinned.getByRole("listitem").first()).toContainText("Před závodem sacharidy 8 g/kg.");
  const history = page.getByRole("region", { name: "Historie" });
  await expect(history.getByText("Prefers simple meals on training days; batch-cooks on Sundays.")).toBeVisible();

  await page.getByRole("navigation", { name: "Zobrazit" }).getByRole("link", { name: "Rozhodnutí" }).click();
  await expect(page).toHaveURL(/type=DECISION/);
  await expect(history.getByText("Carbs up to 7 g/kg on long-ride days; rest days stay at 4 g/kg.")).toBeVisible();
  await expect(history.getByText("Prefers simple meals on training days; batch-cooks on Sundays.")).toHaveCount(0);
  await expect(pinned.getByText("Před závodem sacharidy 8 g/kg.")).toBeVisible();
});
