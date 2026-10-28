import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("coach filters the client list by mode, searches, sorts and switches status tabs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");
  await page.goto("/coach/clients");
  const list = page.getByRole("region", { name: "Seznam klientů" });
  await expect(list.getByRole("link", { name: "Emma Walker" })).toBeVisible();

  await list.getByLabel("Sledování").selectOption("PORTIONS");
  await expect(page).toHaveURL(/mode=PORTIONS/);
  await expect(list.getByRole("link", { name: "Petr Novák" })).toBeVisible();
  await expect(list.getByRole("link", { name: "Emma Walker" })).toHaveCount(0);
  await expect(list.getByRole("link", { name: "Tereza Svobodová" })).toHaveCount(0);
  // Every row left is a PORTIONS client (the invite test may add one).
  for (const row of await list.getByRole("row").all()) await expect(row).toContainText(/Sledování|Porce/);

  await list.getByLabel("Sledování").selectOption("");
  await list.getByRole("searchbox", { name: "Hledat podle jména" }).fill("tereza svobodova");
  await expect(list.getByRole("link", { name: "Petr Novák" })).toHaveCount(0);
  await expect(list.getByRole("link", { name: "Tereza Svobodová" })).toBeVisible();
  await list.getByRole("searchbox", { name: "Hledat podle jména" }).fill("nikdo");
  await expect(list.getByText("Hledání ani filtru neodpovídá žádný klient.")).toBeVisible();
  await list.getByRole("button", { name: "Zrušit filtry" }).click();
  await expect(list.getByRole("link", { name: "Petr Novák" })).toBeVisible();
  await expect(list.getByRole("searchbox", { name: "Hledat podle jména" })).toHaveValue("");

  await list.getByRole("link", { name: "Jméno" }).click();
  await expect(list.getByRole("columnheader", { name: "Jméno" })).toHaveAttribute("aria-sort", "descending");

  await list.getByRole("link", { name: /^Neaktivní/ }).click();
  await expect(list.getByRole("link", { name: "Lucie Králová" })).toBeVisible();
  await expect(list.getByRole("button", { name: "Znovu aktivovat Lucie Králová" })).toBeVisible();
  await expect(list.getByRole("link", { name: "Petr Novák" })).toHaveCount(0);

  // Deactivation asks first; cancelling changes nothing (src/app/coach/clients/clients.test.ts covers the action).
  await list.getByRole("link", { name: /^Aktivní/ }).click();
  await list.getByRole("button", { name: "Deaktivovat Emma Walker" }).click();
  const dialog = page.getByRole("dialog", { name: "Deaktivovat Emma Walker?" });
  await expect(dialog).toContainText("Všechna data zůstanou.");
  await dialog.getByRole("button", { name: "Zrušit" }).click();
  await expect(dialog).toBeHidden();
  await expect(list.getByRole("link", { name: "Emma Walker" })).toBeVisible();
});
