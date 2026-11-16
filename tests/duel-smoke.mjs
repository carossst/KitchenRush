// Smoke test for Duel mode. Plays full matches with a scripted bot and fails on:
//   - a stall (phase/score/ball id unchanged for 7 s), - a console or page error,
//   - a match that never ends, - missing saved history, - a broken FR/EN toggle.
// Usage: start a static server (python3 -m http.server 8123), then
//   node tests/duel-smoke.mjs            (needs `playwright`: npm i -D playwright)
// Env: BASE_URL (default http://localhost:8123), DUEL_SCENARIOS="right:idle,left:bot,singles:bot"
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL || "http://localhost:8123";
const SCENARIOS = (process.env.DUEL_SCENARIOS || "singles:bot,left:bot,right:idle,daily:bot").split(",");
let failed = 0;
const fail = (m) => { failed++; console.error("FAIL", m); };

async function run(browser, mode, who) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(BASE + "/index.html");
  await page.waitForTimeout(700);
  await page.evaluate(() => { const o = KR_UI.prototype._startDuel; KR_UI.prototype._startDuel = function () { window.__ui = this; return o.call(this); }; });
  await page.click('[data-action="play-duel"]');
  await page.waitForTimeout(300);
  if (mode === "daily") await page.click('[data-duel="daily"]');
  else { if (mode !== "singles") await page.click('[data-duel="' + mode + '"]'); await page.click('[data-duel="go"]'); }
  let last = "", lastAt = Date.now(), ended = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 110000) {
    await page.waitForTimeout(33);
    const r = await page.evaluate((bot) => {
      const d = window.__ui._duel; if (!d) return { gone: 1 };
      if (d.phase === "menu") return { menu: 1, score: d.score };
      const h = d.human, b = d.ball; d.keys = {};
      if (d.phase === "serve" && d.server === h && d.now - d.phaseAt > 0.4 && !(d.now < h.swingUntil)) d._swing(0.3, 0.5);
      if (bot && b && b.live && !b.dead && b.lastHitTeam === 1) {
        const pr = d._predict(), t = pr.after || pr.bounce;
        if (t && pr.bounce.y < 0 && pr.bounce.x >= h.zone[0] && pr.bounce.x < h.zone[1]) {
          if (t.x < h.x - 0.4) d.keys.l = true; if (t.x > h.x + 0.4) d.keys.r = true;
          const gy = Math.min(-1.5, t.y - 1);
          if (gy > h.y + 0.4) d.keys.u = true; if (gy < h.y - 0.4) d.keys.d = true;
          if (b.bounces >= 1 && Math.hypot(b.x - h.x, b.y - h.y) < 3.2 && !(d.now < h.swingUntil)) d._swing(Math.random() < 0.5 ? -0.8 : 0.8, 0.6);
        }
      }
      return { k: d.phase + "|" + d.score.join("-") + "|" + (b ? b.id : "") };
    }, who === "bot");
    if (r.gone) break;
    if (r.menu) { ended = r.score; break; }
    if (r.k !== last) { last = r.k; lastAt = Date.now(); }
    else if (Date.now() - lastAt > 7000) { fail(mode + ":" + who + " stalled at " + last); break; }
  }
  if (!ended) { if (!failed) fail(mode + ":" + who + " match did not end in time"); }
  else {
    await page.waitForTimeout(1300);
    const info = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("kr:duel") || "{}");
      const first = document.querySelector(".kr-duel-start, .kr-duel-go")?.textContent;
      return { hist: (s.history || []).length, hasStats: !!document.querySelector(".kr-duel-stats"), first };
    });
    if (mode === "daily") {
      const dly = await page.evaluate(() => JSON.parse(localStorage.getItem("kr:duel") || "{}").daily);
      if (!dly || !dly.key) fail("daily: result not saved");
      if (info.hist !== 0) fail("daily: a Daily Duel must not add ladder history");
      if (!(await page.$('[data-duel="share"]'))) fail("daily: share button missing after the match");
    } else if (info.hist < 1) fail(mode + ":" + who + " no match history saved");
    if (!info.hasStats) fail(mode + ":" + who + " stats block missing on the match menu");
    const before = await page.evaluate(() => document.querySelector(".kr-duel-go").textContent);
    await page.click('[data-duel="lang"]');
    const after = await page.evaluate(() => document.querySelector(".kr-duel-go").textContent);
    if (before === after) fail(mode + ":" + who + " language toggle changed nothing");
    console.log("ok", mode + ":" + who, "score", JSON.stringify(ended), "history", info.hist);
  }
  if (errors.length) fail(mode + ":" + who + " errors: " + errors.slice(0, 3).join(" | "));
  await page.close();
}

const browser = await chromium.launch();
for (const sc of SCENARIOS) { const [m, w] = sc.split(":"); await run(browser, m, w || "bot"); }
await browser.close();
process.exit(failed ? 1 : 0);
