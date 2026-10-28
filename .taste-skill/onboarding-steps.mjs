// Snapshots of every onboarding step: accepts the seeded demo invite as martin@demo.cz, then snaps and continues.
// Needs a fresh seed and a server at SNAP_BASE (default :3100).
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { renameSync } from "node:fs";

const base = process.env.SNAP_BASE ?? "http://localhost:3100";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/invite/demo-invite`);
const accept = page.getByRole("button", { name: "Přijmout jako tento e-mail" });
if (await accept.count()) await accept.click();
else {
  // Already accepted on an earlier run: sign in and go back to the first step.
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: "martin@demo.cz" }).click();
  await page.waitForURL(/\/onboarding/);
  while (await page.getByRole("button", { name: "Zpět" }).count()) {
    const h1 = await page.getByRole("heading", { level: 1 }).textContent();
    await page.getByRole("button", { name: "Zpět" }).click();
    await page.getByRole("heading", { level: 1 }).filter({ hasNotText: h1 }).waitFor();
  }
}
await page.waitForURL(/\/onboarding/);
// Each step and the h1 of the one after it.
const steps = [["welcome", "O vás"], ["about", "Váš cíl"], ["goal", "Hotovo"], ["done"]];
for (const [step, next] of steps) {
  execSync("node .taste-skill/snap.mjs martin@demo.cz:/onboarding", { stdio: "inherit", env: { ...process.env, SNAP_BASE: base } });
  renameSync(".taste-skill/snap/onboarding.html", `.taste-skill/snap/onboarding-${step}.html`);
  if (!next) break;
  await page.reload();
  if (step === "goal") await page.getByRole("radio", { name: "Zhubnout tuk" }).check();
  await page.getByRole("button", { name: "Pokračovat" }).click();
  await page.getByRole("heading", { level: 1, name: next }).waitFor();
}
await browser.close();
