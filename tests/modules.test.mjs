// Unit tests (no browser) for share-card.js and analytics.js, run in a Node VM with small stubs. Run: node tests/modules.test.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

let failed = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { failed++; console.error("FAIL", m); } };
const code = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- share-card.js
function cardEnv(nav) {
  const win = {}; const doc = { createElement: () => ({ width: 0, height: 0, getContext: () => recorder(), toBlob: (cb) => cb(null) }) };
  const ctx = { window: win, document: doc, navigator: nav || {}, Promise, URL, File: undefined };
  vm.createContext(ctx); vm.runInContext(code("share-card.js"), ctx); return win.KR_CARD;
}
function recorder() {
  const texts = [], fills = [];
  const g = () => ({ addColorStop() {} });
  const ctx = new Proxy({ texts, fills }, { get(t, k) {
    if (k in t) return t[k];
    if (k === "fillText") return (s) => texts.push(String(s));
    if (k === "createLinearGradient" || k === "createRadialGradient") return g;
    return () => {};
  }, set(t, k, v) { if (k === "fillStyle") fills.push(String(v)); t[k] = v; return true; } });
  return ctx;
}
const card = cardEnv();
ok(card.W === 1080 && card.H === 1350, "card must be 1080x1350");
let r = recorder(); card.draw(r, { lang: "fr", you: 5, them: 2, name: "Rookie Rae", date: "2026-11-18", urlText: "kitchenrush.app/fr.html" });
ok(r.texts.includes("5 – 2"), "French card shows the score");
ok(r.texts.some((s) => s.includes("contre Rookie Rae")), "French card shows the opponent");
ok(r.texts.includes("Tu fais mieux ?"), "French call to action");
ok(r.texts.some((s) => s.includes("Duel du jour") && s.includes("2026-11-18")), "French title line with the date");
r = recorder(); card.draw(r, { lang: "en", you: 1, them: 5, name: "Boss", date: "2026-11-18" });
ok(r.texts.includes("1 – 5") && r.texts.includes("Can you beat me?") && r.texts.some((s) => s.includes("vs Boss")), "English card");
r = recorder(); card.draw(r, { lang: "en", you: -5, them: 1e9, name: "x".repeat(100) });
ok(r.texts.includes("0 – 99"), "scores are clamped to 0..99");
ok(r.texts.every((s) => s.length <= 80), "long text is truncated");
ok(r.fills.includes("#3ce68c") === false, "a loss is not drawn in the win colour");
r = recorder(); card.draw(r, { lang: "en", you: 5, them: 1 });
ok(r.fills.includes("#3ce68c"), "a win is drawn in the win colour");
card.share({ lang: "en", you: 1, them: 0 }, "t").then((res) => ok(res === "unsupported", "share falls back to text when files cannot be shared"));

// ---------- analytics.js
function analyticsEnv({ search = "", stored = {}, url = "", dnt = "" } = {}) {
  const store = Object.assign({}, stored), scripts = [], calls = [];
  const win = { KR_CONFIG: { analytics: { goatcounterUrl: url } }, location: { search }, doNotTrack: dnt,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    goatcounter: { count: (o) => calls.push(o) } };
  const doc = { readyState: "complete", head: { appendChild: (s) => scripts.push(s) }, createElement: () => { const a = {}; return { set async(v) {}, setAttribute: (k, v) => { a[k] = v; }, attrs: a, set src(v) { a.src = v; } }; }, addEventListener() {} };
  const ctx = { window: win, document: doc, navigator: { doNotTrack: dnt }, URLSearchParams, setTimeout, JSON };
  vm.createContext(ctx); vm.runInContext(code("analytics.js"), ctx);
  return { A: win.KR_Analytics, store, scripts, calls };
}
let e = analyticsEnv({ search: "?src=Coach%20Lyon!!" });
ok(e.A.getSrc() === "coach-lyon" && e.store["kr:src"] === "coach-lyon", "src tag is cleaned and remembered");
ok(e.A.enabled() === false && e.A.track("duel-start") === false && e.scripts.length === 0 && e.calls.length === 0, "OFF by default: nothing is loaded or sent");
e = analyticsEnv({ stored: { "kr:src": "club-x" } });
ok(e.A.getSrc() === "club-x", "the remembered tag is read when the link has none");
ok(e.A.cleanSlug("  Caéfe  !! A/B ") === "ca-fe-a-b" && e.A.cleanSlug("x".repeat(80)).length === 40 && e.A.cleanSlug(null) === "", "slug cleaning");
e = analyticsEnv({ search: "?src=coach-lyon", url: "https://example.goatcounter.com/count" });
ok(e.A.enabled() === true, "enabled once an address is configured");
ok(e.scripts.length === 1 && e.scripts[0].attrs["data-goatcounter"] === "https://example.goatcounter.com/count" && e.scripts[0].attrs.src === "https://gc.zgo.at/count.js", "script loads from GoatCounter only");
ok(e.calls.length === 1 && eq(e.calls[0], { path: "kr/landing/src-coach-lyon", title: "landing", event: true }), "landing event with the source segment");
ok(e.A.track("duel-complete") === true && e.calls[1].path === "kr/duel-complete/src-coach-lyon", "events carry the source segment");
ok(e.A.track("<script>") === true && e.calls[2].path === "kr/script/src-coach-lyon", "event names are sanitised");
e = analyticsEnv({ url: "https://example.goatcounter.com/count", dnt: "1" });
ok(e.A.enabled() === false && e.scripts.length === 0, "Do Not Track is respected");

console.log(checks + " checks, " + failed + " failed");
process.exit(failed ? 1 : 0);
