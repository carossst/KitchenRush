// Rule tests for Duel: drives the game's own methods with crafted ball states (the loop is paused), so it
// is fast and deterministic. Needs a static server and `playwright`. Run: node tests/duel-rules.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE_URL || "http://localhost:8123";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(BASE + "/index.html");
await page.waitForTimeout(700);
await page.evaluate(() => { const o = KR_UI.prototype._startDuel; KR_UI.prototype._startDuel = function () { window.__ui = this; return o.call(this); }; });
await page.click('[data-action="play-duel"]');
await page.waitForTimeout(300);

const results = await page.evaluate(() => {
  const out = [], d0 = window.__ui._duel, T = KR_DUEL._test;
  const t = (name, fn) => { try { const r = fn(); out.push([name, r === true, r === true ? "" : String(r)]); } catch (e) { out.push([name, false, "threw " + e.message]); } };
  const d = d0;
  const fresh = () => { d._startMatch(); d.paused = true; d.phase = "rally"; d.power = null; d.charge = 0; d.score = [0, 0]; };
  const ball = (o) => Object.assign({ x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, live: true, held: false, dead: false, lastHitTeam: 0, bounces: 0, hits: 2, isServe: false, id: ++d.ballId }, o);
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b) || ("got " + JSON.stringify(a) + " expected " + JSON.stringify(b));
  const hitter = (x, y) => { d.human.x = x; d.human.y = y; return d.human; };

  t("ball into the net: point for the other team", () => { fresh(); d.ball = ball({ y: -0.05, vy: 10 }); d._stepBall(0.016); return eq(d.score, [0, 1]); });
  t("first bounce out of bounds: point for the other team", () => { fresh(); d.ball = ball({ y: 23, z: 0, vz: -1, hits: 4 }); d._stepBall(0.016); return eq(d.score, [0, 1]); });
  t("first bounce in bounds: rally continues", () => { fresh(); d.ball = ball({ y: 15, z: 0, vz: -1, hits: 4 }); d._stepBall(0.016); return eq([d.score, d.phase], [[0, 0], "rally"]); });
  t("serve landing in the kitchen is a fault", () => { fresh(); d.ball = ball({ y: 4, z: 0, vz: -1, hits: 1, isServe: true }); d._stepBall(0.016); return eq(d.score, [0, 1]); });
  t("second bounce wins the point for the hitter", () => { fresh(); d.ball = ball({ y: 15, z: 0, vz: -1, bounces: 1, hits: 4 }); d._stepBall(0.016); return eq(d.score, [1, 0]); });
  t("ball landing back on the hitter's own side is a net fault", () => { fresh(); d.ball = ball({ y: -8, z: 0, vz: -1, hits: 4 }); d._stepBall(0.016); return eq(d.score, [0, 1]); });
  t("volley before the 3rd shot is a fault", () => { fresh(); const h = hitter(0, -12); d.ball = ball({ x: 0, y: -12.5, z: 2, lastHitTeam: 1, hits: 1 }); d._tryHit(h, { tx: 0, ty: 15, speed: 30 }, 0); return eq(d.score, [0, 1]); });
  t("volley while standing in the kitchen is a fault", () => { fresh(); const h = hitter(0, -3); d.ball = ball({ x: 0, y: -3.5, z: 2, lastHitTeam: 1, hits: 3 }); d._tryHit(h, { tx: 0, ty: 15, speed: 30 }, 0); return eq(d.score, [0, 1]); });
  t("Kitchen Pass power allows that volley", () => { fresh(); const h = hitter(0, -3); d.power = { key: "pass", until: d.now + 5 }; d.ball = ball({ x: 0, y: -3.5, z: 2, lastHitTeam: 1, hits: 3 }); const r = d._tryHit(h, { tx: 0, ty: 15, speed: 30 }, 0); return eq([r, d.score, d.ball.lastHitTeam], [true, [0, 0], 0]); });
  t("legal volley outside the kitchen is returned", () => { fresh(); const h = hitter(0, -12); d.ball = ball({ x: 0, y: -12.5, z: 2, lastHitTeam: 1, hits: 3 }); const r = d._tryHit(h, { tx: 0, ty: 15, speed: 30 }, 0); return eq([r, d.score, d.ball.vy > 0], [true, [0, 0], true]); });
  t("a dead ball can never be hit", () => { fresh(); const h = hitter(0, -12); d.ball = ball({ x: 0, y: -12.5, z: 2, lastHitTeam: 1, bounces: 1, hits: 3, dead: true }); return eq(d._tryHit(h, { tx: 0, ty: 15, speed: 30 }, 0), false); });
  t("the same team cannot hit twice in a row", () => { fresh(); const h = hitter(0, -12); d.ball = ball({ x: 0, y: -12.5, z: 2, lastHitTeam: 0, bounces: 1, hits: 3 }); return eq(d._tryHit(h, { tx: 0, ty: 15, speed: 30 }, 0), false); });
  t("clean shots (no error) always clear the net", () => {
    for (const ay of [-1, -0.5, 0, 0.5, 1]) for (const ax of [-1, 0, 1]) {
      fresh(); const h = hitter(0, -12); d.ball = ball({ x: 0, y: -12, z: 2, lastHitTeam: 1, bounces: 1, hits: 3 });
      d._launch(h, T.aimToShot(ax, ay, 1), 0, 0);
      let n = 0; while (d.ball.y < 0.5 && n++ < 2000 && d.phase === "rally") d._stepBall(1 / 240);
      if (d.phase !== "rally" || d.score[1] !== 0) return "net fault for aim " + ax + "," + ay;
    }
    return true;
  });
  t("reach power widens the catch radius", () => {
    fresh(); const h = hitter(0, -12); d.ball = ball({ x: 5.5, y: -12, z: 1, lastHitTeam: 1, bounces: 1, hits: 3 });
    const before = d._tryHit(h, { tx: 0, ty: 15, speed: 30 }, 0);
    fresh(); h.x = 0; h.y = -12; d.power = { key: "reach", until: d.now + 5 }; d.ball = ball({ x: 5.5, y: -12, z: 1, lastHitTeam: 1, bounces: 1, hits: 3 });
    return eq([before, d._tryHit(h, { tx: 0, ty: 15, speed: 30 }, 0)], [false, true]);
  });
  t("winning a point charges the power; firing it spends the charge and expires", () => {
    fresh(); d.save.beaten = { 0: true }; d.save.equipped = "reach";
    d._point(0, "winner"); const c1 = d.charge; d.phase = "rally"; d.charge = 3; d._activatePower();
    const active = d._pw("reach"), spent = d.charge; d.now += 11;
    return eq([c1, active, spent, d._pw("reach")], [1, true, 0, false]);
  });
  t("power cannot fire without a full charge", () => { fresh(); d.save.beaten = { 0: true }; d.save.equipped = "reach"; d.charge = 2; d._activatePower(); return eq(d._pw("any"), false); });
  t("seeded RNG is reproducible and seed-sensitive", () => {
    const a = T.seeded(42), b = T.seeded(42), c = T.seeded(43), xa = [], xb = [], xc = [];
    for (let i = 0; i < 20; i++) { xa.push(a()); xb.push(b()); xc.push(c()); }
    return eq(xa, xb) === true && JSON.stringify(xa) !== JSON.stringify(xc) && xa.every((v) => v >= 0 && v < 1) ? true : "seed behaviour wrong";
  });
  t("daily info is well formed and stable within a day", () => { const a = T.dailyInfo(), b = T.dailyInfo(); return /^\d{4}-\d{2}-\d{2}$/.test(a.key) && a.idx >= 0 && a.idx < 7 && a.seed === b.seed ? true : "bad daily info"; });
  t("rally ramp: later shots are faster (max +30%)", () => {
    const rate = (hits) => { fresh(); const h = hitter(0, -12); d.ball = ball({ x: 0, y: -12, z: 2, lastHitTeam: 1, bounces: 1, hits }); d._launch(h, { tx: 0, ty: 15, speed: 30 }, 0, 0); return d.ball.rate; };
    const r1 = rate(1), r12 = rate(12), r40 = rate(40);
    // and the faster clock really moves the ball further per step
    fresh(); d.ball = ball({ x: 0, y: -12, z: 5, vy: 10, rate: 1 }); d._stepBall(0.01); const slow = d.ball.y + 12;
    fresh(); d.ball = ball({ x: 0, y: -12, z: 5, vy: 10, rate: 1.3 }); d._stepBall(0.01); const fast = d.ball.y + 12;
    return (r1 < 1.05 && r12 > 1.25 && r12 <= 1.3001 && r40 === r12 && fast > slow * 1.25) ? true : "rates " + r1 + " / " + r12 + " / " + r40 + " moves " + slow + " vs " + fast;
  });
  t("a capsule spawns in a rally, on the player's half, and not in the Daily", () => {
    fresh(); d.capsule = null; d.capSpawnIn = 0; d.ball = ball({ hits: 3 }); d._capsules(0.016);
    const c = d.capsule; const okSpawn = !!c && c.y < -8 && c.y > -18 && T.POWERS.includes(c.kind);
    fresh(); d.daily = { key: "2026-01-01", idx: 0, seed: 1 }; d.capsule = null; d.capSpawnIn = 0; d.ball = ball({ hits: 3 }); d._capsules(0.016); const none = d.capsule === null; d.daily = null;
    return eq([okSpawn, none], [true, true]);
  });
  t("catching a capsule grants its power; an old capsule vanishes", () => {
    fresh(); const h = hitter(3, -12); d.capsule = { x: 3, y: -12, kind: "sprint", born: d.now - 2, until: d.now + 5 }; d._capsules(0.016);
    const got = [d._pw("sprint"), d.capsule === null];
    fresh(); d.capsule = { x: 3, y: -12, kind: "sprint", born: d.now - 20, until: d.now - 1 }; d._capsules(0.016);
    return eq([got, d.capsule === null, d._pw("any")], [[true, true], true, false]);
  });
  t("the boss: stage 7 is the boss, rage triggers at 3 points", () => {
    d.stage = 6; const boss = d._opp(); d._startMatch(); d.paused = true;
    for (let i = 0; i < 3; i++) { d.phase = "rally"; d._point(1, "winner"); }
    const r = d._rage; d.stage = 0;
    return eq([boss.boss === true, boss.name, r], [true, "Captain Kitchen", true]);
  });
  t("coins: a win vs opponent 1 pays 25, a loss little, the Daily once a day", () => {
    fresh(); d.save.coins = 0; d.score = [5, 2]; d._afterPoint(); const win = d.save.coins; d.stage = 0;
    fresh(); d.save.coins = 0; d.score = [3, 5]; d._afterPoint(); const lose = d.save.coins; d.stage = 0;
    fresh(); d.save.coins = 0; d.save.daily = null; d.daily = { key: "2099-01-01", idx: 0, seed: 1 }; d.score = [5, 1]; d._afterPoint(); const d1 = d.save.coins;
    fresh(); d.save.coins = 0; d.daily = { key: "2099-01-01", idx: 0, seed: 1 }; d.score = [5, 1]; d._afterPoint(); const d2 = d.save.coins; d.save.daily = null; d.stage = 0;
    return eq([win, lose, d1, d2], [25, 9, 25, 0]);
  });
  t("shop: no purchase without coins, one purchase, equip only what you own", () => {
    fresh(); d.save.coins = 100; d.save.owned = {}; d.save.player = "alex";
    d._panelAction("pl-sasha"); const a1 = [d.save.coins, !!d.save.owned.sasha, d.save.player];
    d.save.coins = 130; d._panelAction("pl-sasha"); const a2 = [d.save.coins, !!d.save.owned.sasha, d.save.player];
    d.save.player = "alex"; d._panelAction("pl-sasha"); const a3 = [d.save.coins, d.save.player];
    d._panelAction("pl-nobody"); d.save.player = "alex"; d.save.owned = {};
    return eq([a1, a2, a3], [[100, false, "alex"], [10, true, "sasha"], [10, "sasha"]]);
  });
  t("player skills apply; the Daily always uses the base player", () => {
    fresh(); d.save.owned = { chen: true, sasha: true }; d.save.player = "sasha"; const sp = d._pstat("speed"); d._startMatch(); d.paused = true; const start = d.charge;
    d.save.player = "chen"; const need = d._chargeMax();
    d.daily = { key: "2099-01-01", idx: 0, seed: 1 }; const dly = d._player().id; d.daily = null; d.save.player = "alex"; d.save.owned = {};
    return eq([sp, start, need, dly], [1.12, 1, 2, "alex"]);
  });
  t("worlds: stage 7 restarts the ladder, tougher", () => { d.stage = 7; const o = d._opp(), w = d._world(); d.stage = 0; return eq([w, o.name, o.speed > KR_DUEL.ladder[0].speed], [2, KR_DUEL.ladder[0].name, true]); });
  t("venues follow the stage; locked or invalid choices are ignored", () => {
    const at = (stage, sel) => { d.stage = stage; d.save.venue = sel; d.daily = null; return d._venueId(); };
    const r = [at(0, "auto"), at(2, "auto"), at(6, "auto"), at(7, "auto"), at(0, "gym"), at(5, "gym"), at(5, "constructor")];
    d.stage = 0; d.save.venue = "auto";
    return eq(r, ["park", "beach", "stadium", "park", "park", "gym", "rooftop"]);
  });
  t("every venue renders", () => { d.stage = 6; for (const id of ["park", "beach", "night", "gym", "rooftop", "stadium"]) { d.save.venue = id; d._bg = null; d._drawBackground(); if (d._bgVenue !== id) return "venue not applied: " + id; } d.stage = 0; d.save.venue = "auto"; d._bg = null; return true; });
  t("every capsule kind renders", () => { fresh(); for (const key of T.POWERS) { d.capsule = { x: 0, y: -12, kind: key, born: d.now - 2, until: d.now + 5 }; d._drawCapsule(d.ctx); } d.capsule = null; d.ball = ball({ hits: 8 }); d._drawRally(d.ctx); return true; });
  t("every power renders without errors", () => {
    fresh(); d.paused = true;
    for (const key of T.POWERS) { d.power = { key, until: d.now + 5 }; d.flashUntil = d.now + 0.2; d._flashKey = key; d._drawPowerFx(d.ctx); d._drawPowerTint(d.ctx); d._powerHud(); }
    d.power = null; d._powerHud(); d._drawPowerFx(d.ctx); d._drawPowerTint(d.ctx);
    return true;
  });
  t("corrupted saved data is sanitised", () => {
    d.destroy();
    localStorage.setItem("kr:duel", JSON.stringify({ history: "x", beaten: { 99999: true, a: true, 2: true }, equipped: "hack", daily: { key: "bad" }, lang: "zz", bestMargin: 9999, venue: "../x", coins: -5, owned: { chen: true, hacker: true }, player: "hacker" }));
    window.__ui._startDuel(); const s = window.__ui._duel.save;
    return eq([Array.isArray(s.history), Object.keys(s.beaten), s.equipped, s.daily, s.lang, s.bestMargin, s.venue, s.coins, Object.keys(s.owned), s.player], [true, ["2"], "", null, "", 99, "auto", 0, ["chen"], "alex"]);
  });
  return out;
});

let failed = 0;
for (const [name, ok, detail] of results) { if (ok) console.log("ok  ", name); else { failed++; console.error("FAIL", name, detail); } }
if (errors.length) { failed++; console.error("FAIL console/page errors:", errors.slice(0, 3).join(" | ")); }
console.log(results.length + " rule checks, " + failed + " failed");
await browser.close();
process.exit(failed ? 1 : 0);
