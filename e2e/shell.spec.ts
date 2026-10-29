import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("client on a phone: bottom nav with Today and More, the account in the More sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "general@demo.cz");
  await expect(page).toHaveURL("/app");
  await expect(page.locator("aside")).toBeHidden();

  // Only the bottom bar is visible at this width; general@ has no sport and no sessions, so no Training tab.
  const nav = page.getByRole("navigation", { name: "Hlavní navigace" });
  await expect(nav.getByRole("link")).toHaveText(["Dnes", "Výživa", /^Zprávy/]);
  await expect(nav.getByRole("link", { name: "Dnes" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Odpočinkový den")).toBeVisible();

  await nav.getByRole("button", { name: "Více" }).click();
  const more = page.getByRole("dialog", { name: "Více" });
  await more.getByRole("button", { name: "Zavřít" }).click();
  await expect(more).toBeHidden();
  await nav.getByRole("button", { name: "Více" }).click();
  await expect(more.getByText("Petr Novák")).toBeVisible();
  await more.getByRole("button", { name: "Odhlásit se" }).click();
  await expect(page).toHaveURL("/login");
});

test("coach on a desktop: sidebar with the pages so far, active clients tile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");

  const nav = page.getByRole("navigation", { name: "Hlavní navigace" });
  await expect(nav.getByRole("link")).toHaveText(["Přehled", "Klienti", "Check-iny", /^Zprávy/, "Kalendář", "Knihovna", "Nápověda", "Nastavení"]); // Zprávy may carry an unread count
  await expect(nav.getByRole("link", { name: "Přehled" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Více" })).toBeHidden();

  // The list opens on the active clients: the tile's count (the invite test may add one in the meantime).
  const tile = page.getByRole("link", { name: /^Aktivní klienti \d+$/ });
  const active = Number((await tile.textContent())!.replace(/\D/g, ""));
  await tile.click();
  await expect(page).toHaveURL("/coach/clients");
  const rows = page.getByRole("region", { name: "Seznam klientů" }).getByRole("row");
  await expect(rows.filter({ hasText: "Petr Novák" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "Lucie Králová" })).toHaveCount(0);
  expect((await rows.count()) - 1).toBe(active); // minus the header row
  await expect(nav.getByRole("link", { name: "Klienti" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Přehled" })).not.toHaveAttribute("aria-current");
});
