import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("coach suggests sports@'s rest-day targets, saves, and the client's bell shows the plan update", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  await page.goto("/coach/clients");
  await page.getByRole("link", { name: "Emma Walker" }).click();
  await page.getByRole("navigation", { name: "Sekce klienta" }).getByRole("link", { name: "Výživa" }).click();

  const rest = page.getByRole("region", { name: "Odpočinkový den" });
  await expect(rest.getByLabel("Energie (kcal)")).toHaveValue("2200"); // seeded
  await page.getByLabel("Aktivita").selectOption({ label: "Vysoká aktivita (×1,725)" });
  await page.getByRole("button", { name: "Navrhnout odpočinkový den" }).click();
  await expect(rest.getByLabel("Energie (kcal)")).not.toHaveValue("2200");
  await expect(rest.getByLabel("Bílkoviny (g)")).toHaveValue("122"); // 2 g/kg of 61.2 kg
  await expect(rest.getByText("2 g/kg")).toBeVisible();
  await expect(rest.getByLabel("Tekutiny (ml)")).toHaveValue("2150"); // 35 ml/kg → 2142 → 2150
  await page.getByRole("button", { name: "Uložit cíle" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Uloženo" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Historie cílů" }).getByRole("row")).toHaveCount(4); // header + 2 seeded + today's REST

  const client = await (await browser.newContext()).newPage();
  await logIn(client, "sports@demo.cz");
  await client.getByRole("link", { name: "Notifications, 1 unread" }).click();
  await expect(client.getByRole("button", { name: "Unread: Your nutrition plan was updated" })).toBeVisible();
});
