import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

// Everything that depends on general@'s tracking mode, in one file so it runs in order: the guidance test switches the
// mode to GUIDANCE and back, which would break the PORTIONS tests if they ran beside it.
test("general@ sees the seeded plan in hand portions", async ({ page }) => {
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
});

test("general@ adds a palm of protein to breakfast in half portions: the day total follows; the guide explains the hands", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "general@demo.cz");
  await expect(page).toHaveURL("/app");
  await page.getByRole("navigation", { name: "Hlavní navigace" }).getByRole("link", { name: "Výživa" }).click();
  const breakfast = page.getByRole("region", { name: "Snídaně" });
  const palms = page.getByRole("region", { name: "Typ dne" }).getByRole("meter", { name: "Bílkoviny (dlaně)" });
  await expect(palms).toHaveAttribute("aria-valuetext", "0 / 6");
  await expect(breakfast).toContainText("v plánu 1");

  const more = breakfast.getByRole("button", { name: "Přidat půl porce: Bílkoviny (dlaně)" });
  await more.click();
  await more.click();
  await expect(breakfast.getByRole("status", { name: "Bílkoviny (dlaně)" })).toHaveText("1");
  await expect(palms).toHaveAttribute("aria-valuetext", "1 / 6");

  await page.getByText("Jak počítat porce").click();
  await expect(page.getByText("Dlaň bílkovin")).toBeVisible();

  const less = breakfast.getByRole("button", { name: "Ubrat půl porce: Bílkoviny (dlaně)" });
  await less.click();
  await less.click();
  await expect(palms).toHaveAttribute("aria-valuetext", "0 / 6");
});

test("the coach switches general@ to GUIDANCE, the client marks lunch \"partly\", and the coach switches back", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  const switchTo = async (mode: string) => {
    await page.goto("/coach/clients");
    await page.getByRole("link", { name: "Petr Novák" }).click();
    await page.getByRole("button", { name: "Změnit sledování" }).click();
    const dialog = page.getByRole("dialog", { name: "Sledování pro Petr Novák" });
    await dialog.getByRole("radio", { name: new RegExp(`^${mode}`) }).check();
    await dialog.getByRole("button", { name: "Uložit" }).click();
    await expect(page.getByText(`Sledování: ${mode}`)).toBeVisible();
  };
  await switchTo("Bez počítání");

  const client = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await logIn(client, "general@demo.cz");
  await expect(client).toHaveURL("/app");
  await client.goto("/app/nutrition");
  const lunch = client.getByRole("region", { name: "Oběd" });
  await expect(lunch).toContainText("Maso nebo luštěniny, příloha, půl talíře zeleniny."); // the plan's guidance for the meal
  await lunch.getByRole("button", { name: "Částečně" }).click();
  await expect(lunch.getByRole("button", { name: "Částečně" })).toHaveAttribute("aria-pressed", "true");
  const score = client.getByRole("region", { name: "Typ dne" }).getByRole("meter", { name: "Dodržená jídla" });
  await expect(score).toHaveAttribute("aria-valuetext", "0,5 z 4");
  await client.reload();
  await expect(lunch.getByRole("button", { name: "Částečně" })).toHaveAttribute("aria-pressed", "true");

  // Back to hand portions: the portion log is still there (switching never deletes data); the mark is cleared for the next run.
  await lunch.getByRole("button", { name: "Částečně" }).click();
  await expect(score).toHaveAttribute("aria-valuetext", "0 z 4");
  await switchTo("Porce");
});
