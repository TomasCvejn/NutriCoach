// Signed-in screens as static snapshots, because inspect.mjs can't sign in. Needs `npm run dev` on :3000.
//   node .taste-skill/snap.mjs coach@demo.cz:/coach general@demo.cz:/app
//   node .claude/skills/design-taste-frontend/scripts/inspect.mjs .taste-skill/snap/app.html --widths 1440,390 --out .taste-skill/app/inspect
// Scripts are dropped (the server-rendered DOM is the screen); CSS and fonts are mirrored next to the HTML.
// --out must sit under .taste-skill/app/ so the inspector finds direction.json and judges by the app rules.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// SNAP_BASE=http://localhost:3100 snaps a side server (NEXT_DIST_DIR=.next-e2e) while `npm run dev` keeps :3000.
const base = process.env.SNAP_BASE ?? "http://localhost:3000";
const out = ".taste-skill/snap";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const arg of process.argv.slice(2)) {
  const [email, path] = arg.split(":");
  const name = path.split("/").filter(Boolean).join("-");
  const page = await browser.newPage();
  await page.goto(`${base}/login`);
  await page.getByRole("button", { name: email }).click();
  await page.waitForURL(/\/(coach|app)/);
  await page.goto(base + path, { waitUntil: "networkidle" });
  const html = (await page.content()).replace(/<script\b[\s\S]*?<\/script>/g, "").replaceAll('"/_next/', '"_next/');
  const urls = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name));
  const paths = new Set(urls.map((u) => new URL(u).pathname).filter((p) => p.startsWith("/_next/static/") && /\.(css|woff2?)$/.test(p)));
  for (const p of paths) {
    const body = await (await page.request.get(base + p)).body();
    const file = join(out, decodeURIComponent(p.slice(1)));
    mkdirSync(dirname(file), { recursive: true });
    // CSS that points at /_next/static/media/... would leave the snapshot folder.
    writeFileSync(file, p.endsWith(".css") ? body.toString().replaceAll("/_next/static/", "../".repeat(p.split("/").length - 4)) : body);
  }
  writeFileSync(join(out, `${name}.html`), html);
  console.log(`${out}/${name}.html`);
  await page.close();
}
await browser.close();
