// Accessibility test: runs axe-core (WCAG 2.0/2.1 A and AA rules) on the main screens and fails on serious or critical
// violations that are not listed in KNOWN (each entry needs a reason and a follow-up). Needs a static server, playwright and
// axe-core. Run: node tests/a11y.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axePath = require.resolve("axe-core/axe.min.js");
const BASE = process.env.BASE_URL || "http://localhost:8123";

// rule id -> why it is tolerated for now. Keep this list short and shrinking.
const KNOWN = {};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.addInitScript(() => { try { localStorage.setItem("kr:duel", JSON.stringify({ coached: true, picked: true, stage: 3, coins: 150, owned: { sprint: true }, beaten: { 0: true, 1: true, 2: true }, history: [{ you: 5, them: 2, stage: 0 }] })); } catch (e) { } });
let failed = 0;

async function scan(name) {
  await page.addScriptTag({ path: axePath });
  const res = await page.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
  const bad = res.violations.filter((v) => (v.impact === "serious" || v.impact === "critical") && !(v.id in KNOWN));
  const minor = res.violations.filter((v) => !bad.includes(v));
  console.log((bad.length ? "FAIL " : "ok   ") + name + (minor.length ? "  (tolerated or minor: " + minor.map((v) => v.id + "[" + v.impact + "]").join(", ") + ")" : ""));
  for (const v of bad) { failed++; console.error("   " + v.id + " [" + v.impact + "] " + v.help + "\n   " + v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\n")[1]).join("\n   ")); }
}

for (const [path, name] of [["/index.html?lang=en", "landing (English)"], ["/fr.html", "landing (French, fr.html)"]]) {
  await page.goto(BASE + path); await page.waitForTimeout(700); await scan(name);
}
await page.goto(BASE + "/index.html?lang=en"); await page.waitForTimeout(500);
await page.click('[data-action="play-duel"]'); await page.waitForTimeout(500);
await scan("Duel home");
await page.click('[data-duel="hub"]'); await page.waitForTimeout(300);
await page.locator('[data-duel="tab-play"]').focus();
await page.keyboard.press("ArrowRight");
assert.equal(await page.locator('[data-duel="tab-players"]:focus[aria-selected="true"]').count(), 1);
assert.equal(await page.getByRole("tabpanel").getAttribute("aria-labelledby"), "kr-duel-tab-players");
assert.equal(await page.locator('[data-duel="tab-play"]').getAttribute("tabindex"), "-1");
await page.keyboard.press("End");
assert.equal(await page.locator('[data-duel="tab-progress"]:focus[aria-selected="true"]').count(), 1);
await page.keyboard.press("Home");
await page.keyboard.press("ArrowRight");
await page.locator('[data-duel="pl-sprint"]').focus();
await page.keyboard.press("Enter");
assert.equal(await page.locator('[data-duel="pl-sprint"]:focus[aria-pressed="true"]').count(), 1);
assert.equal(await page.locator('canvas[data-portrait="sprint"]:visible').count(), 1);
await page.keyboard.press("Tab");
assert.equal(await page.locator('[data-duel="pl-reach"]:focus').count(), 1);
const menuFitsAtScrollStart = await page.locator(".kr-duel-panel").evaluate((panel) => {
  panel.style.height = "240px";
  panel.scrollTop = 0;
  const card = panel.querySelector(".kr-duel-card");
  const accessible = panel.scrollHeight > panel.clientHeight &&
    card.getBoundingClientRect().top >= panel.getBoundingClientRect().top;
  panel.style.removeProperty("height");
  return accessible;
});
assert.equal(menuFitsAtScrollStart, true);
console.log("ok   Duel menu keyboard navigation, player preview focus and short-screen scrolling");

for (const tab of ["play", "players", "courts", "progress"]) { await page.click('[data-duel="tab-' + tab + '"]'); await page.waitForTimeout(150); await scan("Duel menu, tab " + tab); }
await page.click('[data-duel="tab-players"]'); await page.click('[data-duel="select"]'); await page.waitForTimeout(200); await scan("Duel select screen");
await page.click('[data-duel="selok"]'); await page.click('[data-duel="tab-play"]'); await page.click('[data-duel="go"]');
await page.click('[data-duel="sel-sprint"]');
assert.equal(await page.locator('.kr-duel-equipped').textContent(), "Equipped");
await page.click('[data-duel="sel-reach"]');
assert.equal(await page.locator('[data-duel="selok"]').isEnabled(), false);
await page.click('[data-duel="sel-sprint"]');
await page.click('[data-duel="selok"]');
assert.equal(await page.locator('[data-court-preview]:visible').count(), 8);
assert.equal(await page.locator('.kr-duel-steps [aria-current="step"]').textContent(), "Court");
await page.click('[data-duel="court-park"]');
assert.equal(await page.locator('.kr-duel-court-hero canvas').getAttribute("data-court-preview"), "park");
await scan("Duel court selection");
await page.click('[data-duel="court-ok"]'); await page.waitForTimeout(200); await scan("Duel versus screen");
await page.click('[data-duel="versus-go"]'); await page.waitForTimeout(800); await scan("Duel in match");
for (const [path, name] of [["/poster.html?lang=en&club=Test", "poster"]]) { await page.goto(BASE + path); await page.waitForTimeout(600); await scan(name); }

await browser.close();
console.log(failed ? failed + " serious or critical accessibility violation(s)" : "no serious or critical violations");
process.exit(failed ? 1 : 0);
