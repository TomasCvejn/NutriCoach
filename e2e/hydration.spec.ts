import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("a client adds 500 ml: the ring follows, the drink is listed, and deleting it brings the ring back", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "race@demo.cz");
  await expect(page).toHaveURL("/app");
  // Home widget 4 has the quick adds too; the page has the list.
  await expect(page.getByRole("region", { name: "Hydratace" }).getByRole("meter", { name: "Tekutiny dnes" })).toHaveAttribute("aria-valuetext", "0 ml z 2 050 ml");
  await page.getByRole("button", { name: "Více" }).click();
  await page.getByRole("link", { name: "Hydratace" }).click();
  await expect(page).toHaveURL("/app/hydration");

  const ring = page.getByRole("meter", { name: "Tekutiny dnes" });
  await expect(ring).toHaveAttribute("aria-valuetext", "0 ml z 2 050 ml");
  await page.getByRole("button", { name: "+500 ml" }).click();
  await expect(ring).toHaveAttribute("aria-valuetext", "500 ml z 2 050 ml");
  await expect(page.getByRole("listitem").filter({ hasText: "Voda" })).toContainText("500 ml");

  await page.getByRole("button", { name: /^Upravit nápoj z / }).click();
  await page.getByRole("dialog", { name: "Upravit nápoj" }).getByRole("button", { name: "Smazat" }).click();
  await expect(ring).toHaveAttribute("aria-valuetext", "0 ml z 2 050 ml");
});
