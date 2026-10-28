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

// Same file as the targets test, so the two changes to sports@'s plan run one after the other.
test("coach adds a meal and a recommendation for race@, then copies race@'s plan to sports@", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  const nutritionOf = async (name: string) => {
    await page.goto("/coach/clients");
    await page.getByRole("link", { name }).click();
    await page.getByRole("navigation", { name: "Sekce klienta" }).getByRole("link", { name: "Výživa" }).click();
  };

  await nutritionOf("Tereza Svobodová");
  const meals = page.getByRole("region", { name: "Jídla" });
  await meals.getByRole("button", { name: "Přidat jídlo" }).click();
  const mealDialog = page.getByRole("dialog", { name: "Nové jídlo" });
  await mealDialog.getByLabel("Název").fill("Pozdní svačina");
  await mealDialog.getByLabel("Čas").fill("22:00");
  await mealDialog.getByRole("button", { name: "Uložit" }).click();
  await expect(mealDialog).toBeHidden();
  await expect(meals.getByRole("listitem").last()).toContainText("Pozdní svačina · 22:00");

  const recommendations = page.getByRole("region", { name: "Doporučení", exact: true });
  await recommendations.getByRole("button", { name: "Přidat doporučení" }).click();
  const recDialog = page.getByRole("dialog", { name: "Nové doporučení" });
  await recDialog.getByLabel("Nadpis").fill("Spánek před závodem");
  await recDialog.getByRole("button", { name: "Uložit" }).click();
  await expect(recommendations.getByText("Spánek před závodem")).toBeVisible();

  await nutritionOf("Emma Walker");
  await expect(meals.getByText("Oats with lactose-free yoghurt and fruit.")).toBeVisible();
  await page.getByRole("button", { name: "Kopírovat plán od klienta" }).click();
  const copy = page.getByRole("dialog", { name: "Kopírovat plán pro Emma Walker" });
  await copy.getByLabel("Kopírovat od").selectOption({ label: "Tereza Svobodová" });
  await copy.getByRole("button", { name: "Kopírovat a nahradit" }).click();
  await expect(copy).toBeHidden();
  await expect(meals.getByText("Pozdní svačina")).toBeVisible();
  await expect(meals.getByText("Oats with lactose-free yoghurt and fruit.")).toHaveCount(0);
  await expect(recommendations.getByText("Spánek před závodem")).toBeVisible();
  await expect(page.getByRole("region", { name: "Odpočinkový den" }).getByLabel("Energie (kcal)")).toHaveValue("2100");
});
