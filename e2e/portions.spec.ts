import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

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
