import { expect, test } from "@playwright/test";

test("home page renders in Czech by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "NutriCoach" })).toBeVisible();
  await expect(page.getByText("Výživový koučink pro trenéry a jejich klienty")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
});

test("a signed-in user's locale beats the cookie", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "locale", value: "cs", url: baseURL! }]);
  // Better Auth's CSRF check wants the Origin header a browser sends.
  const res = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL! },
    data: { email: "sports@demo.cz", password: "demo1234" },
  });
  expect(res.ok()).toBe(true);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("locale cookie en renders English", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "locale", value: "en", url: baseURL! }]);
  await page.goto("/");
  await expect(page.getByText("Nutrition coaching for coaches and their clients")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
