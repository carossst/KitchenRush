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
  const fresh = () => { d.save.coached = true; d._startMatch(); d.paused = true; d.phase = "rally"; d.power = null; d.charge = 0; d.score = [0, 0]; };
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
    fresh(); d.save.owned = { reach: true }; d.save.player = "reach";
    d._point(0, "winner"); const c1 = d.charge; d.phase = "rally"; d.charge = 3; d._activatePower();
    const active = d._pw("reach"), spent = d.charge; d.now += 11;
    return eq([c1, active, spent, d._pw("reach")], [1, true, 0, false]);
  });
  t("power cannot fire without a full charge", () => { fresh(); d.save.owned = { reach: true }; d.save.player = "reach"; d.charge = 2; d._activatePower(); return eq(d._pw("any"), false); });
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
  t("catching a capsule gives +1 super charge (no random power); an old capsule vanishes", () => {
    fresh(); const h = hitter(3, -12); d.charge = 0; d.capsule = { x: 3, y: -12, kind: "sprint", born: d.now - 2, until: d.now + 5 }; d._capsules(0.016);
    const got = [d.charge, d._pw("any"), d.capsule === null];
    fresh(); d.capsule = { x: 3, y: -12, kind: "sprint", born: d.now - 20, until: d.now - 1 }; d._capsules(0.016);
    return eq([got, d.capsule === null, d._pw("any")], [[1, false, true], true, false]);
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
    fresh(); d.save.coins = 100; d.save.owned = {}; d.save.player = "touch";
    d._panelAction("act-sprint"); const a1 = [d.save.coins, !!d.save.owned.sprint, d.save.player];
    d.save.coins = 130; d._panelAction("act-sprint"); const a2 = [d.save.coins, !!d.save.owned.sprint, d.save.player];
    d.save.player = "touch"; d._panelAction("act-sprint"); const a3 = [d.save.coins, d.save.player];
    d._panelAction("act-nobody"); d.save.player = "touch"; d.save.owned = {};
    return eq([a1, a2, a3], [[100, false, "touch"], [10, true, "sprint"], [10, "sprint"]]);
  });
  t("player skills apply; the Daily always uses the base player", () => {
    fresh(); d.save.owned = { precision: true, sprint: true }; d.save.player = "sprint"; const sp = d._pstat("speed"); d._startMatch(); d.paused = true; const s0 = d.charge;
    d.save.player = "precision"; d._startMatch(); d.paused = true; const start = d.charge, need = d._chargeMax();
    d.daily = { key: "2099-01-01", idx: 0, seed: 1 }; const dly = [d._player().id, d._equippedKey(), d._pstat("speed")]; d.daily = null; d.save.player = "touch"; d.save.owned = {};
    return eq([sp, s0, start, need, dly], [1.12, 0, 1, 3, ["base", "", 1]]);
  });
  t("tutorial: the first match is gentler and completes the tutorial", () => {
    d.save.coached = false; d.stage = 0; const easy = d._opp(), base = KR_DUEL.ladder[0];
    const a = [easy.speed < base.speed, easy.err > base.err];
    d._startMatch(); d.paused = true; d.phase = "rally"; d.score = [5, 1]; d._afterPoint(); d.stage = 0;
    const done = d.save.coached, back = d._opp().speed === base.speed; d.save.coached = true;
    return eq([a, done, back], [[true, true], true, true]);
  });
  t("first Duel opens with a guided return and records the first legal hit", () => {
    d.daily = null; d.save.coached = false; d._startMatch(); d.paused = true;
    d._coachTick();
    const guided = d.server.team === 1 && d._guidedReturn && !d.coachEl.hidden;
    d.now += 1.2; d._update(0.016);
    const feed = d.ball.live && d.ball.isServe && d.ball.lastHitTeam === 1;
    d.ball = ball({ x: d.human.x, y: d.human.y, z: 2, lastHitTeam: 1, bounces: 1, hits: 1 });
    const returned = d._tryHit(d.human, { tx: 0, ty: 13, speed: 30 }, 0);
    d._coachTick();
    const done = d.save.coached && !d._guidedReturn && d._coachKey === "coachFirstReturn";
    d._startMatch(); d.paused = true;
    return eq([guided, feed, returned, done, d.serverTeam], [true, true, true, true, 0]);
  });
  t("menu tabs switch panels without re-rendering", () => {
    d.tab = "play"; d._showMenu(); d._panelAction("tab-players");
    const sel = [...d.panelEl.querySelectorAll(".kr-duel-tab")].map((b) => b.getAttribute("aria-selected"));
    const vis = [...d.panelEl.querySelectorAll("[data-tabpanel]")].map((p) => !p.hidden);
    d._panelAction("tab-nope"); d._panelAction("tab-play");
    return eq([sel, vis, d.tab], [["false", "true", "false", "false"], [false, true, false, false], "play"]);
  });
  t("player preview: tapping explains, the action button buys only when affordable", () => {
    d.save.owned = {}; d.save.coins = 0; d.save.player = "touch"; d._showMenu(); d._panelAction("pl-pass");
    const b1 = d.panelEl.querySelector('[data-duel="act-pass"]'), r1 = [d.previewPlayer, b1 && b1.disabled, d.save.coins];
    d.save.coins = 300; d._panelAction("pl-pass"); const b2 = d.panelEl.querySelector('[data-duel="act-pass"]'), r2 = b2 && b2.disabled;
    d._panelAction("act-pass"); const r3 = [!!d.save.owned.pass, d.save.coins, d.save.player];
    d.save.owned = {}; d.save.coins = 0; d.save.player = "touch"; d.previewPlayer = null;
    return eq([r1, r2, r3], [["pass", true, 0], false, [true, 20, "pass"]]);
  });
  t("a locked court explains itself when tapped and is not selected", () => {
    d.stage = 0; d.save.venue = "auto"; d._showMenu(); d._panelAction("venue-stadium");
    const msg = d.panelEl.textContent.includes("7 to unlock"), kept = d.save.venue;
    d._panelAction("venue-auto"); return eq([msg, kept], [true, "auto"]);
  });
  t("playtest log: one entry per match, exportable, capped", () => {
    localStorage.removeItem("kr:duel-stats"); fresh(); d.score = [5, 2]; d._afterPoint(); d.stage = 0;
    const log = JSON.parse(localStorage.getItem("kr:duel-stats")), ex = JSON.parse(d._exportData());
    return eq([log.length, log[0].you, log[0].them, Array.isArray(log[0].pts), ex.matches.length, ex.app], [1, 5, 2, true, 1, "kitchen-rush-duel"]);
  });
  t("sound is off by default, the visible button toggles it, vibration respects reduced motion", () => {
    const calls = [], hap = [], old = [d.opts.sound, d.opts.haptic, d.opts.setSound];
    d.opts.sound = (n) => calls.push(n); d.opts.haptic = (n) => hap.push(n); d.opts.setSound = () => {};
    d.save.sound = false; d._updateSoundBtn(); d._sound("smash"); const muted = calls.length === 0, label0 = d.soundEl.getAttribute("aria-pressed");
    d.soundEl.click(); const on = [d.save.sound, d.soundEl.getAttribute("aria-pressed"), calls.length > 0];
    calls.length = 0; d._sound("smash"); const played = calls.length === 1;
    d._buzz("smash"); const buzzed = hap.length === 1; d.fx.reduced = true; d._buzz("smash"); const calm = hap.length === 1; d.fx.reduced = false;
    d.soundEl.click(); const off = [d.save.sound, d.soundEl.getAttribute("aria-pressed")];
    [d.opts.sound, d.opts.haptic, d.opts.setSound] = old; d.save.sound = false; d._updateSoundBtn();
    return eq([muted, label0, on, played, buzzed, calm, off], [true, "false", [true, "true", true], true, true, true, [false, "false"]]);
  });
  t("sharing the Daily pays a bonus once a day", () => {
    d.save.shareDay = ""; d.save.coins = 0; d._shareReward(); const a = d.save.coins; d._shareReward(); const b = d.save.coins;
    d.save.shareDay = "2000-01-01"; d._shareReward(); const c = d.save.coins; d.save.shareDay = ""; d.save.coins = 0;
    return eq([a, b, c], [10, 10, 20]);
  });
  t("the playtest log keeps the campaign source tag", () => {
    localStorage.removeItem("kr:duel-stats"); localStorage.setItem("kr:src", "club-test"); fresh(); d.score = [5, 2]; d._afterPoint(); d.stage = 0;
    const log = JSON.parse(localStorage.getItem("kr:duel-stats")); localStorage.removeItem("kr:src");
    return eq(typeof log[0].src, "string");
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
  t("cast: same stats in both editions, names change, neutral by default", () => {
    const names = (lang, mode) => { d.lang = lang; window.KR_CONFIG.duelNames = mode; return T.cast.map((p) => d._pname(p)); };
    const neutral = names("fr", "neutral"), neutralEn = names("en", "neutral"), fr = names("fr", "fun"), en = names("en", "fun");
    window.KR_CONFIG.duelNames = "neutral"; d.lang = window.KR_LANG || "en";
    const uniq = (a) => new Set(a).size === a.length && a.every((x) => x && x.length < 30);
    return eq([T.cast.length, eq(neutral, neutralEn), uniq(fr), uniq(en), JSON.stringify(fr) === JSON.stringify(en), uniq(neutral)], [6, true, true, true, false, true]);
  });
  t("cast: one super power per character, free first, rising prices, a look per edition", () => {
    const sups = T.cast.map((p) => p.sup).sort(), costs = T.cast.map((p) => p.cost);
    const looks = T.cast.every((p) => p.look && p.look.fr && p.look.en && p.look.fr.skin && p.look.en.skin);
    return eq([sups, costs[0], costs.every((c, i) => i === 0 || c > costs[i - 1]), looks], [[...T.POWERS].sort(), 0, true, true]);
  });
  t("the character look follows the edition", () => {
    const pr = T.cast.find((p) => p.id === "precision"); d.lang = "fr"; const f = d._plook(pr); d.lang = "en"; const e = d._plook(pr); d.lang = window.KR_LANG || "en";
    return eq([f.skin !== e.skin, !!f.hairStyle && !!e.hairStyle], [true, true]);
  });
  t("inspired looks only apply with the fun names switch; missing traits keep the generic value", () => {
    const re = T.cast.find((p) => p.id === "reach"), pa = T.cast.find((p) => p.id === "pass");
    window.KR_CONFIG.duelNames = "neutral"; d.lang = "fr"; const n = d._plook(re).skin;
    window.KR_CONFIG.duelNames = "fun"; const f = d._plook(re), keep = f.hairStyle === re.look.fr.hairStyle && f.skin === "#f4c7a1";
    const none = d._plook(pa).hair === "#a07c52";
    d.lang = "en"; const en = d._plook(pa).hair === "#604537";
    window.KR_CONFIG.duelNames = "neutral"; d.lang = window.KR_LANG || "en";
    return eq([n, keep, none, en], ["#f7d7bd", true, true, true]);
  });
  t("select screen: 6 tiles, preview, buy, continue goes to the menu", () => {
    d.save.owned = {}; d.save.coins = 130; d.save.player = "touch"; d.save.picked = false; d.matchSetup = false; d.previewPlayer = null; d._showSelect();
    const tiles = d.panelEl.querySelectorAll(".kr-duel-tile").length, hero = !!d.panelEl.querySelector(".kr-duel-super");
    d._panelAction("sel-sprint"); const prev = [d.previewPlayer, d.panelEl.querySelector(".kr-duel-hero-name").textContent.length > 0];
    d._panelAction("selact-sprint"); const bought = [d.save.coins, !!d.save.owned.sprint, d.save.player];
    d._panelAction("selok"); const after = [d.save.picked, d.phase, !!d.panelEl.querySelector(".kr-duel-tab")];
    d.save.owned = {}; d.save.coins = 0; d.save.player = "touch"; d.previewPlayer = null;
    return eq([tiles, hero, prev, bought, after], [6, true, ["sprint", true], [10, true, "sprint"], [true, "menu", true]]);
  });
  t("versus screen shows before the match and starts it on tap", () => {
    d.save.coached = true; d._showMenu(); d._panelAction("go");
    const players = d.panelEl.querySelectorAll(".kr-duel-tile").length;
    d._panelAction("selok");
    const courts = d.panelEl.querySelectorAll("[data-court-preview]").length;
    d._panelAction("setup-back");
    const back = !!d.panelEl.querySelector('[data-duel="selok"]');
    d._panelAction("selok"); d._panelAction("court-park"); d._panelAction("court-ok");
    const vs = [!!d.panelEl.querySelector(".kr-duel-versus"), d.phase, d.panelEl.querySelectorAll("canvas").length];
    d._panelAction("versus-go"); d.paused = true;
    return eq([players, courts, back, d.save.venue, vs, d.panelEl.classList.contains("kr-duel-panel--on"), d.phase === "serve" || d.phase === "rally"], [6, 8, true, "park", [true, "menu", 2], false, true]);
  });
  t("defeat offers immediate rematch and keeps the chosen player and court", () => {
    fresh(); d.daily = null; d.save.venue = "park"; d._lastFault = "out";
    d._lastScore = [2, 5]; d._lastEarn = 8; d._lastDailyIdx = null; d._lastResult = "lose"; d.phase = "menu";
    const player = d._player().id, stage = d.stage;
    d._showSplash("lose");
    const note = !!d.panelEl.querySelector(".kr-duel-result-note") && !d._splashT;
    d._panelAction("splash-next"); d.paused = true;
    return eq([note, d.phase, d._player().id, d._venueId(), d.stage], [true, "serve", player, "park", stage]);
  });
  t("victory splash shows the result and returns to the menu", () => {
    d._lastScore = [5, 2]; d._lastEarn = 25; d._lastBoss = false; d._lastResult = "win"; d._showSplash("win");
    const sp = [!!d.panelEl.querySelector(".kr-duel-splash--win"), d.panelEl.textContent.indexOf("5\u20132") >= 0];
    d._panelAction("splash-go");
    return eq([sp, d.phase, !!d.panelEl.querySelector(".kr-duel-tab")], [[true, true], "menu", true]);
  });
  t("Duel difficulty changes the opponent and aim window but leaves Daily fixed", () => {
    fresh(); d.daily = null; d._showMenu();
    d._panelAction("difficulty-relaxed");
    const relaxed = [d._opp().speed, d._opp().react, d._slowBudget()];
    const persisted = JSON.parse(localStorage.getItem("kr:duel")).difficulty;
    d._panelAction("difficulty-challenge");
    const challenge = [d._opp().speed, d._opp().react, d._slowBudget()];
    d.daily = { idx: 0, key: "2099-01-01", seed: 1 };
    const daily = [d._opp().speed, d._slowBudget()];
    d.save.difficulty = "relaxed";
    const sameDaily = JSON.stringify(daily) === JSON.stringify([d._opp().speed, d._slowBudget()]);
    d.daily = null; d.save.difficulty = "standard";
    return eq([relaxed[0] < challenge[0], relaxed[1] > challenge[1], relaxed[2] > challenge[2], persisted, sameDaily],
      [true, true, true, "relaxed", true]);
  });
  t("touch zones stay stable in slow motion and use the final release coordinates", () => {
    fresh(); d.timeScale = 0.2;
    const rect = d.canvas.getBoundingClientRect();
    const touch = (id, x, y) => ({ pointerType: "touch", pointerId: id, clientX: rect.left + x, clientY: rect.top + y, preventDefault() {} });
    d._pDown(touch(1, d.W * 0.25, 100));
    d._pDown(touch(2, d.W * 0.75, 100));
    const both = !!d.joy && !!d.swipe;
    d._pUp(touch(2, d.W * 0.75 - 45, 62));
    const aim = d.human.aimX < 0 && d.human.aimY > 0 && !!d.joy;
    const swing = d.human.swingUntil;
    d._pDown(touch(3, d.W * 0.75, 100));
    d._pUp(touch(3, d.W * 0.75, 100), true);
    const cancelled = !d.swipe && d.human.swingUntil === swing;
    d._pUp(touch(1, d.W * 0.25, 100));
    return eq([both, aim, cancelled, !d.joy], [true, true, true, true]);
  });
  t("drill scores the actual bounce, pays only the first success, and preserves ladder progress", () => {
    d.save.coins = 0; d.save.drillBests.deep = 0;
    const stage = d.stage, history = d.save.history.length, mode = d.mode;
    function run() {
      d._panelAction("drill-deep"); d.paused = true;
      const practice = d.server.team === 1 && d.actors.length === 2 && !d._equippedKey();
      for (let i = 0; i < 5; i++) {
        d.phase = "rally";
        d.ball = ball({ x: i < 3 ? 0 : 8, y: 15, z: 0.01, vz: -2, lastHitTeam: 0, bounces: 0 });
        d._stepBall(0.016);
        d._afterPoint();
      }
      return practice;
    }
    const practice = run(), first = d.save.coins;
    run();
    return eq([practice, first, d.save.coins, d.save.drillBests.deep, d.stage, d.save.history.length, d.mode, d.drill],
      [true, 30, 30, 3, stage, history, mode, null]);
  });
  t("power shop debits once, equips only a purchased alternative and leaves Daily neutral", () => {
    d.save.coins = 39; d.save.powerLicenses = {}; d.save.shopPower = "";
    d._panelAction("shop-power-touch"); const refused = d.save.coins;
    d.save.coins = 100; d._panelAction("shop-power-reach");
    const bought = [d.save.coins, d._equippedKey(), d.save.powerLicenses.reach];
    d._panelAction("shop-native"); d._panelAction("shop-power-reach");
    d.daily = { key: "2099-01-01", idx: 0, seed: 1 }; const daily = d._equippedKey(); d.daily = null;
    const balance = d.save.coins; d._panelAction("shop-native");
    return eq([refused, bought, balance, daily, d.save.shopPower], [39, [40, "reach", true], 40, "", ""]);
  });
  t("a loss suggests a drill and returns to the same matchup", () => {
    fresh(); d.save.venue = "park"; d.daily = null; d._lastDailyIdx = null; d._lastResult = "lose"; d.phase = "menu";
    d._m.pts = ["1:kitchen", "0:net", "1:kitchen", "1:out"];
    const opponent = d._oppIdx(), player = d._player().id, mode = d.mode;
    d._showSplash("lose");
    const offered = !!d.panelEl.querySelector('[data-duel="splash-drill"]');
    d._panelAction("splash-drill"); d.paused = true;
    const drill = d.drill.id;
    d.drill.attempts = 5;
    d._finishDrill();
    d._panelAction("drill-rematch"); d.paused = true;
    return eq([offered, drill, d.drill, d.phase, d._oppIdx(), d._player().id, d._venueId(), d.mode],
      [true, "soft", null, "serve", opponent, player, "park", mode]);
  });
  t("drill marks a missed bounce and can switch pace without changing target", () => {
    d._panelAction("drill-soft"); d.paused = true; d.phase = "rally";
    const touch = d._returnShot(0.3, -0.8, d.drill.style);
    d.shotStyleEl.click();
    const drive = d._returnShot(0.3, -0.8, d.drill.style);
    d.ball = ball({ x: -8, y: 4, z: 0.01, vz: -2, lastHitTeam: 0, bounces: 0 });
    d._stepBall(0.016);
    const mark = d.drill.mark;
    const feedback = d.bannerEl.textContent === d.t.drillMissReasons.left;
    d._finishDrill();
    return eq([touch.tx === drive.tx, touch.ty === drive.ty, touch.speed < drive.speed, touch.loft, drive.loft,
      mark.x, mark.y, mark.hit, feedback, d.shotStyleEl.hidden],
      [true, true, true, true, false, -8, 4, false, true, true]);
  });
  t("power trial is charged on every feed and does not change wallet, equipment or records", () => {
    const snapshot = () => JSON.stringify([d.save.coins, d.save.shopPower, d.save.powerLicenses, d.save.drillBests]);
    const before = snapshot();
    d._panelAction("trial-reach"); d.paused = true;
    const ready = d.charge === d._chargeMax() && d._equippedKey() === "reach";
    d._activatePower();
    const active = d._pw("reach");
    d._beginServe();
    const reset = d.charge === d._chargeMax() && !d._pw("reach");
    d.drill.hits = 5; d.drill.attempts = 5; d._finishDrill();
    return eq([ready, active, reset, before === snapshot(), d.drill], [true, true, true, true, null]);
  });
  t("corrupted saved data is sanitised", () => {
    d.destroy();
    localStorage.setItem("kr:duel", JSON.stringify({ history: "x", beaten: { 99999: true, a: true, 2: true }, equipped: "hack", daily: { key: "bad" }, lang: "zz", bestMargin: 9999, venue: "../x", coached: "yes", sound: "yes", shareDay: "bad", coins: -5, owned: { sprint: true, hacker: true }, player: "hacker" }));
    window.__ui._startDuel(); const s = window.__ui._duel.save;
    return eq([Array.isArray(s.history), Object.keys(s.beaten), s.equipped, s.daily, s.lang, s.bestMargin, s.venue, s.coins, Object.keys(s.owned), s.player, s.coached, s.sound, s.shareDay], [true, ["2"], "", null, "", 99, "auto", 0, ["sprint"], "touch", false, false, ""]);
  });
  return out;
});

let failed = 0;
for (const [name, ok, detail] of results) { if (ok) console.log("ok  ", name); else { failed++; console.error("FAIL", name, detail); } }
if (errors.length) { failed++; console.error("FAIL console/page errors:", errors.slice(0, 3).join(" | ")); }
console.log(results.length + " rule checks, " + failed + " failed");
await browser.close();
process.exit(failed ? 1 : 0);
