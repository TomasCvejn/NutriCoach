import { expect, test } from "@playwright/test";
import { logIn } from "./dev-login";

test("coach: the seeded unread notification shows on the bell until marked read", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page, "coach@demo.cz");
  await expect(page).toHaveURL("/coach");

  await page.getByRole("link", { name: "Oznámení, 1 nepřečtené" }).click();
  await expect(page).toHaveURL("/coach/notifications");
  await expect(page.getByRole("heading", { name: "Oznámení" })).toBeVisible();
  await expect(page.getByText("1 nepřečtené")).toBeVisible();
  await expect(page.getByRole("button", { name: /Úvodní nastavení dokončeno/ })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Nepřečtené: Úvodní nastavení dokončeno: Tereza Svobodová" })).toBeVisible();

  await page.getByRole("button", { name: "Označit vše jako přečtené" }).click();
  await expect(page.getByText("Vše přečteno")).toBeVisible();
  const bell = page.getByRole("link", { name: "Oznámení", exact: true });
  await expect(bell).toHaveText("");
  await page.reload();
  await expect(bell).toHaveText("");
});

// general@'s check-in is open (seeded): the app's first load creates the "check-in due" notification, the home shows the
// reminder; sending the check-in tells the coach. In this file because the coach test above counts the unread exactly.
test("client on a phone: the check-in reminder and its notification; sending it reaches the coach's bell", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logIn(page, "general@demo.cz");
  await expect(page).toHaveURL("/app");
  const reminder = page.getByRole("region", { name: "Týdenní check-in" });
  await expect(reminder).toBeVisible();
  await page.getByRole("link", { name: "Oznámení, 1 nepřečtené" }).click(); // the bell sits in the phone's top bar
  await expect(page).toHaveURL("/app/notifications");
  await page.getByRole("button", { name: /Nepřečtené: Je čas na týdenní check-in/ }).click();
  await expect(page).toHaveURL("/app/check-in");

  for (const scale of ["Energie", "Hlad", "Regenerace", "Trávení", "Trénink a pohyb", "Dodržování plánu", "Nálada"]) {
    await page.getByRole("radio", { name: `${scale}: 7 z 10` }).check({ force: true }); // the radio itself is visually hidden in its chip
  }
  await page.getByLabel("Otázky pro trenéra").fill("Můžu večer ovoce místo sušenky?");
  await page.getByRole("button", { name: "Odeslat check-in" }).click();
  await expect(page.getByRole("heading", { name: "Odesláno, trenér ho brzy projde" })).toBeVisible();
  await page.goto("/app");
  await expect(reminder).toHaveCount(0);

  const coach = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await logIn(coach, "coach@demo.cz");
  await expect(coach).toHaveURL("/coach");
  await coach.getByRole("link", { name: "Oznámení, 1 nepřečtené" }).click();
  await expect(coach.getByRole("button", { name: "Nepřečtené: Nový check-in: Petr Novák" })).toBeVisible();
});
