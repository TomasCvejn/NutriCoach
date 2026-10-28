import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

// The nutrition plan and the day, coach and client side. One file, so the tests that change sports@'s plan run last.
test("each demo client sees their seeded plan in their mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "general@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.getByRole("button", { name: "Více" }).click();
  await page.getByRole("link", { name: "Plán" }).click();
  await expect(page.getByRole("heading", { name: "Váš plán", level: 1 })).toBeVisible();
  const targets = page.getByRole("region", { name: "Denní cíle · Odpočinkový den" });
  await expect(targets).toContainText("6 dlaní");
  await expect(targets).toContainText("4 palce");
  await expect(targets).toContainText("3 300 ml");
  await expect(page.getByRole("region", { name: "Jídla" })).toContainText("Snídaně · 10:00");
  await expect(page.getByRole("region", { name: "Od trenéra" })).toContainText("Bílkoviny v každém jídle");
  await expect(page.getByRole("region", { name: "Jen pro vás" })).toContainText("Pracuje na směny");
  await expect(page.getByRole("navigation", { name: "Typ dne" })).toHaveCount(0); // general@'s plan covers rest days only

  const sports = await (await page.context().browser()!.newContext()).newPage();
  await logIn(sports, "sports@demo.cz");
  await expect(sports).toHaveURL("/app");
  await sports.goto("/app/plan");
  await expect(sports.getByRole("region", { name: "Daily targets · Rest day" })).toContainText("2,200 kcal");
  await sports.getByRole("navigation", { name: "Day type" }).getByRole("link", { name: "Training day" }).click();
  await expect(sports.getByRole("region", { name: "Daily targets · Training day" })).toContainText("2,700 kcal");
  await expect(sports.getByRole("region", { name: "Meals" })).toContainText("Pre-training · 5:30");

  const race = await (await page.context().browser()!.newContext()).newPage();
  await logIn(race, "race@demo.cz");
  await expect(race).toHaveURL("/app");
  await race.goto("/app/plan?day=COMPETITION");
  await expect(race.getByRole("region", { name: "Jídla" })).toContainText("Snídaně · 3 h před startem");
  await expect(race.getByRole("region", { name: "Od trenéra" })).toContainText("Bez luštěnin 3 dny před závodem");
});

test("sports@ sets today to a training day: the badge and the targets follow, and automatic brings the rest day back", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "sports@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Nutrition" }).click();
  await expect(page.getByRole("heading", { name: "Nutrition", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Day" })).toContainText("Today");

  const day = page.getByRole("region", { name: "Day type" });
  await expect(day.getByRole("heading")).toHaveText("Day type: Rest day");
  await expect(day).toContainText("2,200 kcal");
  await expect(page.getByRole("region", { name: "Breakfast" })).toBeVisible(); // the plan's rest-day meals

  await day.getByLabel("Day type").selectOption("TRAINING");
  await expect(day.getByRole("heading")).toHaveText("Day type: Training day");
  await expect(day.getByText("set by hand")).toBeVisible();
  await expect(day).toContainText("2,700 kcal");
  await expect(page.getByRole("region", { name: "Pre-training" })).toBeVisible();

  await day.getByLabel("Day type").selectOption("");
  await expect(day.getByRole("heading")).toHaveText("Day type: Rest day");
  await expect(day).toContainText("2,200 kcal");
});

test("sports@ logs 150 g of a seeded own food: OFF unavailable notice, totals and bars update; then deletes it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "sports@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.goto("/app/nutrition");
  const breakfast = page.getByRole("region", { name: "Breakfast" });
  await expect(breakfast).toContainText("Nothing logged yet.");

  await breakfast.getByRole("button", { name: "Add to Breakfast" }).click();
  const dialog = page.getByRole("dialog", { name: "Add to Breakfast" });
  await dialog.getByRole("searchbox", { name: "Search foods" }).fill("skyr");
  await expect(dialog.getByRole("status")).toHaveText(/Open Food Facts couldn't be reached/); // e2e points OFF at a closed port
  await dialog.getByRole("button", { name: /Lactose-free skyr/ }).click();
  await dialog.getByRole("button", { name: "Grams" }).click();
  await dialog.getByLabel("Amount (g)").fill("150");
  await expect(dialog.getByText("95 kcal · P 16.5 g · C 6 g · F 0.3 g")).toBeVisible();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect(breakfast.getByRole("listitem")).toContainText("Lactose-free skyr · 150 g");
  await expect(breakfast.getByRole("listitem")).toContainText("95 kcal");
  const day = page.getByRole("region", { name: "Day type" });
  await expect(day.getByRole("meter", { name: "Energy" })).toHaveAttribute("aria-valuetext", "95 / 2,200 kcal");
  await expect(day.getByRole("meter", { name: "Protein" })).toHaveAttribute("aria-valuetext", "16.5 / 120 g");

  await breakfast.getByRole("button", { name: "Edit Lactose-free skyr" }).click();
  await page.getByRole("dialog", { name: "Edit entry" }).getByRole("button", { name: "Delete" }).click();
  await expect(breakfast).toContainText("Nothing logged yet.");
});

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
