// Browser tests (needs a static server and playwright): French entry page, language priority, poster with a club-tagged QR,
// source tagging and the share-card picture. Run: node tests/pages-browser.test.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE_URL || "http://localhost:8123";
let failed = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { failed++; console.error("FAIL", m); } };

const browser = await chromium.launch();
async function open(path, setup) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), errors = [];
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  if (setup) await page.addInitScript(setup);
  await page.goto(BASE + path); await page.waitForTimeout(700);
  return { page, ctx, errors };
}

let t = await open("/fr.html");
ok(await t.page.evaluate(() => document.documentElement.lang === "fr" && window.KR_LANG === "fr"), "fr.html opens in French");
ok((await t.page.innerText("body")).includes("L'arcade du pickleball"), "fr.html shows the French landing text");
ok(t.errors.length === 0, "fr.html console errors: " + t.errors.join(" | "));
await t.page.click('[data-action="lang"]'); await t.page.waitForTimeout(700);
ok(t.page.url().includes("lang=en") && await t.page.evaluate(() => window.KR_LANG === "en"), "the language button switches to English from fr.html");
ok((await t.page.innerText("body")).includes("Fast pickleball arcade"), "English text after the switch");
await t.ctx.close();

t = await open("/fr.html", () => { try { localStorage.setItem("kr:lang", "en"); } catch (e) { } });
ok(await t.page.evaluate(() => window.KR_LANG === "fr"), "fr.html beats a saved English choice (French links open in French)");
await t.ctx.close();

t = await open("/index.html?lang=fr");
ok(await t.page.evaluate(() => window.KR_LANG === "fr" && localStorage.getItem("kr:lang") === "fr"), "?lang=fr is applied and remembered");
await t.ctx.close();

t = await open("/index.html?src=Test%20Coach");
ok(await t.page.evaluate(() => localStorage.getItem("kr:src") === "test-coach" && KR_Analytics.getSrc() === "test-coach"), "source tag is captured from the link");
const img = await t.page.evaluate(() => { const c = KR_CARD.render({ lang: "fr", you: 5, them: 2, name: "Rookie Rae", date: "2026-11-18", urlText: "x" }); const p = c.getContext("2d").getImageData(540, 100, 1, 1).data; return [c.width, c.height, p[3]]; });
ok(img[0] === 1080 && img[1] === 1350 && img[2] === 255, "the share card renders a 1080x1350 opaque picture");
await t.ctx.close();

t = await open("/poster.html?lang=fr&club=Club%20Lyon%20%C3%89t%C3%A9");
const q = await t.page.evaluate(() => ({ url: document.getElementById("qr").getAttribute("data-url"), svg: !!document.querySelector("#qr svg"), by: document.getElementById("by").textContent }));
ok(q.svg, "the poster draws the QR code in the browser");
ok(q.url.endsWith("fr.html?duel=deep&src=club-club-lyon-ete"), "the French QR points to fr.html with the club tag: " + q.url);
ok(q.by.includes("Club Lyon Été"), "the club name is printed on the poster");
await t.page.emulateMedia({ media: "print" });
ok(await t.page.evaluate(() => getComputedStyle(document.getElementById("club-form")).display === "none"), "the club form is hidden when printing");
await t.page.emulateMedia({ media: "screen" });
await t.page.click('.bar [data-l="en"]');
ok((await t.page.getAttribute("#qr", "data-url")).includes("?lang=en&duel=deep&src=club-club-lyon-ete"), "the English QR keeps the tag");
await t.page.fill("#club-name", "<img src=x onerror=alert(1)>"); await t.page.click("#club-go");
const safe = await t.page.evaluate(() => ({ url: document.getElementById("qr").getAttribute("data-url"), imgs: document.querySelectorAll("#by img").length }));
ok(/src=club-img-src-x-onerror-alert-1$/.test(safe.url) && safe.imgs === 0, "a hostile club name is neutralised: " + safe.url);
ok(t.errors.length === 0, "poster console errors: " + t.errors.join(" | "));
await t.ctx.close();

t = await open("/fr.html?duel=deep&src=club-test");
await t.page.locator('[data-action="play-duel"]').click();
ok(await t.page.locator(".kr-duel-score").textContent() === "0 cibles · 0/5 balles", "the club link starts the French five-ball drill");
await t.ctx.close();

t = await open("/index.html?lang=en&duel=daily&src=daily-share");
await t.page.locator('[data-action="play-duel"]').click();
ok(await t.page.locator('[data-duel="versus-go"] [data-portrait="base"]').count() === 1, "the shared link opens Daily with the neutral character");
await t.ctx.close();

await browser.close();
console.log(checks + " checks, " + failed + " failed");
process.exit(failed ? 1 : 0);
