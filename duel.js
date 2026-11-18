// duel.js - Duel mode for Kitchen Rush: a real rally against AI opponents.
// Self-contained (own engine, 3D-projected renderer, input and DOM), mounted full-screen on <body>.
// Singles or doubles (pick your side). You aim every shot; the opponent can be beaten.
//
// World units: feet. x across (-10..10), y along (-22 near baseline .. 22 far), z up. Net at y=0.
// Team 0 = near side (human), team 1 = far side.
// Entry point: KR_DUEL.start({ wording, sound(name), appName, onExit() }).

(() => {
  "use strict";

  var CW = 10, CL = 22, KIT = 7, NET_H = 3, G = 30, BALL_R = 0.24;
  var WIN_SCORE = 5;
  var DIFFICULTIES = {
    relaxed: { speed: 0.88, reaction: 1.25, error: 1.2, focus: 1.35 },
    standard: { speed: 1, reaction: 1, error: 1, focus: 1 },
    challenge: { speed: 1.12, reaction: 0.82, error: 0.8, focus: 0.8 }
  };
  var STORE_KEY = "kr:duel";
  // Local-only playtest log (never sent anywhere): used for balancing, exported by the player on request.
  var STATS_KEY = "kr:duel-stats", STATS_MAX = 60;
  function readStats() {
    try { var a = JSON.parse(localStorage.getItem(STATS_KEY) || "[]"); return Array.isArray(a) ? a.filter(function (e) { return e && typeof e === "object"; }).slice(-STATS_MAX) : []; }
    catch (_) { return []; }
  }
  function writeStats(a) { try { localStorage.setItem(STATS_KEY, JSON.stringify(a)); } catch (_) { } }

  var LADDER = [
    { name: "Rookie Rae", tag: "Just here for fun", look: 3, trait: "centre", speed: 10, react: 0.38, err: 2.6, aggr: 0.15, lobP: 0.05, dinkP: 0.15, volley: false, judge: 2, pace: 0.85,
      pal: { jerseyA: "#ffe27a", jerseyB: "#f5a524", shorts: "#7a4b12", hair: "#c9632b", band: "#ffffff", paddle: "#3fd0ff" } },
    { name: "Dinking Dee", tag: "Soft hands, short balls", look: 1, trait: "tempo", speed: 11.5, react: 0.3, err: 2, aggr: 0.35, lobP: 0.05, dinkP: 0.5, volley: false, judge: 1.4, pace: 0.9,
      pal: { jerseyA: "#9af0c4", jerseyB: "#22b07d", shorts: "#0e4f3a", hair: "#2b1d12", band: "#ffd60a", paddle: "#ff5d8f" } },
    { name: "Lobster Lou", tag: "Loves the high ball", look: 6, trait: "sides", speed: 12.5, react: 0.26, err: 1.7, aggr: 0.5, lobP: 0.35, dinkP: 0.2, volley: false, judge: 1, pace: 0.95,
      pal: { jerseyA: "#ff9d8a", jerseyB: "#e2452f", shorts: "#6b1408", hair: "#f2e2c4", band: "#ffffff", paddle: "#ffd60a" } },
    { name: "Banger Bo", tag: "Hits everything hard", look: 5, trait: "right", speed: 13.5, react: 0.22, err: 1.5, aggr: 0.7, lobP: 0.05, dinkP: 0.1, volley: true, judge: 0.7, pace: 1.12,
      pal: { jerseyA: "#d5b4ff", jerseyB: "#7b4dff", shorts: "#2b1a5c", hair: "#20182e", band: "#ff5d8f", paddle: "#9bffb0" } },
    { name: "Spin Sam", tag: "Finds every corner", look: 4, trait: "left", speed: 14.5, react: 0.18, err: 1.2, aggr: 0.82, lobP: 0.15, dinkP: 0.35, volley: true, judge: 0.4, pace: 1.05,
      pal: { jerseyA: "#8ad8ff", jerseyB: "#0f6fd6", shorts: "#06254d", hair: "#101018", band: "#ffffff", paddle: "#ff8a3d" } },
    { name: "Kitchen Ace", tag: "Owns the line", look: 7, trait: "tempo", speed: 15.5, react: 0.14, err: 0.9, aggr: 0.95, lobP: 0.2, dinkP: 0.4, volley: true, judge: 0.2, pace: 1.12,
      pal: { jerseyA: "#3a3a4a", jerseyB: "#11111a", shorts: "#000000", hair: "#101018", band: "#ffd60a", paddle: "#ffd60a", trim: "#ffd60a" } },
    // Final boss: bigger, red aura, "rage" at 3 points (faster, harder shots). Never gives a power.
    { name: "Captain Kitchen", tag: "Final boss: never misses a dink", look: 2, trait: "tempo", boss: true, speed: 17, react: 0.1, err: 0.7, aggr: 1, lobP: 0.25, dinkP: 0.45, volley: true, judge: 0.1, pace: 1.18,
      pal: { jerseyA: "#ffd66e", jerseyB: "#b8860b", shorts: "#1a1a1a", hair: "#101018", band: "#ff3b3b", paddle: "#ff3b3b", trim: "#ff3b3b" } }
  ];
  // Courts ("levels" you can also pick from the menu). `unlock` = opponent index you must have reached.
  var VENUE_ORDER = ["park", "beach", "night", "gym", "rooftop", "stadium"];
  var AUTO = ["park", "park", "beach", "night", "gym", "rooftop", "stadium"];   // venue per ladder step (same length as LADDER)
  var VENUES = {
    park:    { unlock: 0, sky: ["#2f8cff", "#aee4ff"], glow: [0.82, 0.25, "255,240,170", 0.5], clouds: true, stand: ["#24407a", "#16264f"], crowd: ["#ff5d8f", "#ffd60a", "#3fd0ff", "#ffffff", "#9bffb0", "#ff8a3d", "#c9a6ff"], ground: ["#2fa862", "#37b36b"], board: ["#0e1b3d", "#ffd60a"], apron: "#1f7fd1", court: "#2f6fed", kitN: "#ff7a45", kitF: "#ff8d5c", line: "#ffffff" },
    beach:   { unlock: 2, sky: ["#ff8a5c", "#ffe0a8"], glow: [0.5, 0.62, "255,214,140", 0.7], scene: "sea", stand: ["#7a4b2a", "#5a361d"], crowd: ["#ffffff", "#ffcf6b", "#ff6b6b", "#2ec4b6", "#ffe8b0"], ground: ["#dcbc78", "#e6c98a"], board: ["#2a1a10", "#ffcf6b"], apron: "#0c8f91", court: "#14b8b2", kitN: "#ff6b4a", kitF: "#ff8466", line: "#ffffff" },
    night:   { unlock: 3, sky: ["#050818", "#1b1f55"], glow: [0.2, 0.3, "200,220,255", 0.35], stars: true, scene: "lights", stand: ["#1a1440", "#0d0a26"], crowd: ["#ff2fa0", "#3fd0ff", "#9bffb0", "#ffffff", "#c9a6ff"], ground: ["#0f2a3a", "#12313f"], board: ["#05060f", "#3fd0ff"], apron: "#1a2f7a", court: "#2b3fd9", kitN: "#ff2fa0", kitF: "#ff4db3", line: "#9ff0ff" },
    gym:     { unlock: 4, sky: ["#4a4f63", "#2d3142"], scene: "gym", stand: ["#3a2f2a", "#241c18"], crowd: ["#e9c46a", "#ffffff", "#e76f51", "#2a9d8f"], ground: ["#bd8745", "#c8924f"], board: ["#1b1f2e", "#ff9d3c"], apron: "#1f5a3d", court: "#2e8b57", kitN: "#e9c46a", kitF: "#f0d27f", line: "#ffffff" },
    rooftop: { unlock: 5, sky: ["#3a1c71", "#ff9f68"], glow: [0.7, 0.8, "255,180,120", 0.6], scene: "skyline", stand: ["#1e1b3a", "#14122b"], crowd: ["#ffffff", "#ff9f68", "#c9a6ff", "#ff7a9c"], ground: ["#6b6f80", "#737788"], board: ["#14122b", "#ff7a9c"], apron: "#2f2e63", court: "#3d6fb5", kitN: "#ff9f43", kitF: "#ffb26b", line: "#ffffff" },
    stadium: { unlock: 6, sky: ["#0a0a14", "#2a1a05"], stars: true, scene: "beams", stand: ["#2b2108", "#14100a"], crowd: ["#ffd23f", "#ffffff", "#ff9f1c", "#f4f1de"], ground: ["#1b1b24", "#20202b"], board: ["#14100a", "#ffd23f"], apron: "#7a5c12", court: "#1d3a8a", kitN: "#c0392b", kitF: "#d9503f", line: "#ffd23f" }
  };
  function hasVenue(id) { return Object.prototype.hasOwnProperty.call(VENUES, id); }
  // The cast: 6 characters, identical in both editions (same stats, same super power, same unlock order and price).
  // Only the display name (and, where it matters, the drawn look) depends on the language. Soft currency only.
  // `sup` is the super power the character always has (charged by points and capsules). `look` is drawn per edition.
  // Names: "neutral" (default, invented names) or "fun" (pun names); chosen by KR_CONFIG.duelNames. No real names here.
  var ROSTER = {
    neutral: { touch: "Alex", sprint: "Sam", reach: "Lou", precision: "Nina", power: "Max", pass: "Kit" },
    fun: {
      fr: { touch: "Jay Devine-Tout", sprint: "No\u00e9 Clic-Clac", reach: "Cyril P\u00e2tissier", precision: "Myriam Dans-le-Mille", power: "Valentine Vermicelle", pass: "Laura Rock-Chef" },
      en: { touch: "Bon Jonesy", sprint: "JW Jetson", reach: "Anna Leigh Watermelon", precision: "Tyra Bullseye", power: "Hayden Patty-Melt", pass: "Anna Bright-Whisk" }
    }
  };
  var PLAYERS = [
    { id: "touch",     sup: "touch",     cost: 0,   pal: { jerseyA: "#d5b4ff", jerseyB: "#7b4dff", shorts: "#2b1a5c" }, stats: { focus: 1.4 },
      look: { fr: { hairStyle: "short", hair: "#20182e", skin: "#e2ab82" }, en: { hairStyle: "short", hair: "#4a2c17", skin: "#f4c7a1" } },
      lookFun: { fr: { hairStyle: "curly", hair: "#352820", skin: "#c68c5e" }, en: { hairStyle: "short", hair: "#79553f", skin: "#f4c7a1", acc: "cap" } } },
    { id: "sprint",    sup: "sprint",    cost: 120, pal: { jerseyA: "#9af0c4", jerseyB: "#22b07d", shorts: "#0e4f3a" }, stats: { speed: 1.12 },
      look: { fr: { hairStyle: "curly", hair: "#1d1512", skin: "#c68c5e" }, en: { hairStyle: "short", hair: "#1d1512", skin: "#a8734d" } },
      lookFun: { fr: { hairStyle: "curly", hair: "#29221e", skin: "#e2ab82", beard: true }, en: { hairStyle: "short", hair: "#382b25", skin: "#f4c7a1", acc: "cap" } } },
    { id: "reach",     sup: "reach",     cost: 160, pal: { jerseyA: "#ffe27a", jerseyB: "#f5a524", shorts: "#7a4b12" }, stats: { reach: 1.15 },
      look: { fr: { hairStyle: "short", hair: "#c9632b", skin: "#f7d7bd" }, en: { hairStyle: "ponytail", hair: "#e8c66a", skin: "#f1c9a5" } },
      lookFun: { fr: { hairStyle: "short", hair: "#4a3a2c", skin: "#f4c7a1", beard: true, acc: "capBack", capColor: "#f1efe6" }, en: { hairStyle: "ponytail", hair: "#bb925e", skin: "#f4c7a1", acc: "glasses" } } },
    { id: "precision", sup: "precision", cost: 200, pal: { jerseyA: "#8ad8ff", jerseyB: "#0f6fd6", shorts: "#06254d" }, stats: {}, startCharge: 1,
      look: { fr: { hairStyle: "bob", hair: "#4a2c17", skin: "#f1c9a5" }, en: { hairStyle: "curly", hair: "#15131c", skin: "#6b4226" } },
      lookFun: { fr: { hairStyle: "ponytail", hair: "#705342", skin: "#f4c7a1" }, en: { hairStyle: "ponytail", hair: "#29211f", skin: "#a8734d", acc: "cap" } } },
    { id: "power",     sup: "power",     cost: 240, pal: { jerseyA: "#ff9d8a", jerseyB: "#e2452f", shorts: "#6b1408" }, stats: {}, smash: true,
      look: { fr: { hairStyle: "long", hair: "#c9632b", skin: "#f7d7bd" }, en: { hairStyle: "short", hair: "#d9d9e3", skin: "#f4c7a1" } },
      lookFun: { fr: { hairStyle: "bun", hair: "#c6ae83", skin: "#f4c7a1" }, en: { hairStyle: "short", hair: "#896647", skin: "#f4c7a1" } } },
    { id: "pass",      sup: "pass",      cost: 280, pal: { jerseyA: "#ffb3c7", jerseyB: "#ff5d8f", shorts: "#ffffff" }, stats: {}, lucky: true,
      look: { fr: { hairStyle: "bun", hair: "#101018", skin: "#e2ab82" }, en: { hairStyle: "ponytail", hair: "#6b3a1e", skin: "#f4c7a1" } },
      lookFun: { fr: { hairStyle: "ponytail", hair: "#a07c52", skin: "#f4c7a1" }, en: { hairStyle: "ponytail", hair: "#604537", skin: "#f4c7a1", acc: "cap" } } }
  ];
  // The Daily Duel is played on equal terms: a plain character with no super power and no passive.
  var DAILY_PLAYER = { id: "base", sup: "", cost: 0, pal: {}, stats: {}, look: null };
  var ALLY = { name: "Partner", speed: 12.5, react: 0.25, err: 1.6, aggr: 0.5, lobP: 0.08, dinkP: 0.25, volley: true, judge: 0.8, pace: 0.95,
    pal: { jerseyA: "#ffb3c7", jerseyB: "#ff5d8f", shorts: "#ffffff", hair: "#6b3a1e", band: "#3fd0ff", paddle: "#3fd0ff" } };
  // Player looks: varied hair and skin so everyone can find themselves. Cycled from the match menu.
  var LOOKS = [
    { hairStyle: "ponytail", hair: "#4a2c17", skin: "#f4c7a1" },
    { hairStyle: "curly", hair: "#1d1512", skin: "#8d5a3b" },
    { hairStyle: "short", hair: "#20182e", skin: "#e2ab82" },
    { hairStyle: "bob", hair: "#c9632b", skin: "#f7d7bd" },
    { hairStyle: "bun", hair: "#101018", skin: "#c68c5e" },
    { hairStyle: "long", hair: "#e8c66a", skin: "#f1c9a5" },
    { hairStyle: "short", hair: "#d9d9e3", skin: "#6b4226" },
    { hairStyle: "long", hair: "#15131c", skin: "#a8734d" }
  ];
  var HUMAN_PAL = { jerseyA: "#ff8a8a", jerseyB: "#e0244f", shorts: "#ffffff", hair: "#4a2c17", band: "#ffd60a", paddle: "#3fd0ff", ring: "rgba(255,255,255,0.9)" };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // Gameplay randomness goes through rand() so a Daily Duel can run on a shared, date-derived seed.
  var RNG = Math.random;
  function rand() { return RNG(); }
  function hash32(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function dailyInfo() {
    var d = new Date(), p2 = function (n) { return n < 10 ? "0" + n : "" + n; };
    var key = d.getUTCFullYear() + "-" + p2(d.getUTCMonth() + 1) + "-" + p2(d.getUTCDate());
    var h = hash32("kr-duel-" + key);
    return { key: key, seed: h, idx: h % LADDER.length };
  }
  function gauss() { return (rand() + rand() + rand() - 1.5) / 0.75; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }

  var HISTORY_MAX = 20;
  // One signature power per opponent, earned by beating them (same index as LADDER). Charged by winning points.
  var POWERS = ["reach", "touch", "power", "precision", "sprint", "pass"];
  var POWER_SHOP = { touch: 40, reach: 60, precision: 80, sprint: 90, power: 100 };
  var DRILL_BALLS = 5;
  var DRILLS = {
    deep: { difficulty: "relaxed", goal: 3, reward: 30, y: [11, 21], halfWidth: 4.5, feed: -14 },
    angle: { difficulty: "standard", goal: 3, reward: 45, y: [9, 21], halfWidth: 2.8, feed: -14 },
    soft: { difficulty: "challenge", goal: 3, reward: 60, y: [1.5, 7], halfWidth: 6, feed: -10 }
  };
  var POWER_SECONDS = 10, CHARGE_MAX = 3;
  var CAPSULE_SECONDS = 7, CAPSULE_LIFE = 8;   // a caught capsule gives a power for 7 s; it vanishes after 8 s
  var POWER_RGB = { reach: "63,208,255", touch: "180,140,255", power: "255,122,46", precision: "255,214,10", sprint: "60,230,140", pass: "255,93,162" };

  // Stored data is untrusted (hand-edited, truncated, from an older version): clamp everything.
  function loadSave() {
    var d = {};
    try { d = JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch (_) { d = {}; }
    if (!d || typeof d !== "object" || Array.isArray(d)) d = {};
    d.history = (Array.isArray(d.history) ? d.history : [])
      .filter(function (e) { return e && typeof e === "object"; })
      .slice(-HISTORY_MAX)
      .map(function (e) {
        return { d: Number(e.d) || 0, stage: clamp(Math.floor(Number(e.stage) || 0), 0, 999), mode: e.mode === "doubles" ? "doubles" : "singles",
          you: clamp(Math.floor(Number(e.you) || 0), 0, 99), them: clamp(Math.floor(Number(e.them) || 0), 0, 99) };
      });
    var beaten = {};
    if (d.beaten && typeof d.beaten === "object") Object.keys(d.beaten).forEach(function (k) { var i = Number(k); if (i >= 0 && i < 999 && d.beaten[k] === true) beaten[Math.floor(i)] = true; });
    d.beaten = beaten;
    d.equipped = POWERS.indexOf(d.equipped) >= 0 ? d.equipped : "";
    d.venue = (d.venue === "auto" || (typeof d.venue === "string" && hasVenue(d.venue))) ? d.venue : "auto";
    d.bestMargin = clamp(Math.floor(Number(d.bestMargin) || 0), 0, 99);
    d.lang = (d.lang === "fr" || d.lang === "en") ? d.lang : "";
    d.coached = d.coached === true;
    d.sound = d.sound === true;
    d.picked = d.picked === true;
    d.shareDay = /^\d{4}-\d{2}-\d{2}$/.test(String(d.shareDay)) ? String(d.shareDay) : "";
    d.coins = clamp(Math.floor(Number(d.coins) || 0), 0, 999999);
    var ownedClean = {};
    PLAYERS.forEach(function (p) { if (p.cost > 0 && d.owned && d.owned[p.id] === true) ownedClean[p.id] = true; });
    d.owned = ownedClean;
    d.player = PLAYERS.some(function (p) { return p.id === d.player && (p.cost === 0 || ownedClean[p.id]); }) ? d.player : "touch";
    var dd = d.daily;
    d.daily = (dd && typeof dd === "object" && /^\d{4}-\d{2}-\d{2}$/.test(String(dd.key)))
      ? { key: String(dd.key), you: clamp(Math.floor(Number(dd.you) || 0), 0, 99), them: clamp(Math.floor(Number(dd.them) || 0), 0, 99), idx: clamp(Math.floor(Number(dd.idx) || 0), 0, 99) } : null;
    var powerLicenses = {};
    Object.keys(POWER_SHOP).forEach(function (id) {
      if (d.powerLicenses && d.powerLicenses[id] === true) powerLicenses[id] = true;
    });
    d.powerLicenses = powerLicenses;
    d.shopPower = Object.prototype.hasOwnProperty.call(powerLicenses, d.shopPower) ? d.shopPower : "";
    var drillBests = {};
    Object.keys(DRILLS).forEach(function (id) {
      drillBests[id] = clamp(Math.floor(Number(d.drillBests && d.drillBests[id]) || 0), 0, DRILL_BALLS);
    });
    d.drillBests = drillBests;
    if (!Object.prototype.hasOwnProperty.call(DIFFICULTIES, d.difficulty)) d.difficulty = "standard";
    return d;
  }
  function writeSave(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (_) { } }

  function Duel(opts) {
    this.opts = opts || {};
    this.save = loadSave();
    this.lang = this.save.lang || window.KR_LANG || (/^fr/i.test(navigator.language || "") ? "fr" : "en");
    this.t = this._dict();
    this._isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    this.stage = clamp(Math.floor(Number(this.save.stage) || 0), 0, 999);
    this.mode = this.save.mode === "doubles" ? "doubles" : "singles";
    this.side = this.save.side === "left" ? "left" : "right";
    this.look = clamp(Math.floor(Number(this.save.look) || 0), 0, LOOKS.length - 1);
    this.timeScale = 1;
    this.slowLeft = 0;
    this.slowBallId = -1;
    this.fx = window.KR_FX ? window.KR_FX.create() : null;
    this.keys = {};
    this.pointers = {};
    this.joy = null;
    this.swipe = null;
    this.now = 0;
    this.phase = "menu";
    this.raf = 0;
    this._mount();
    this._updateSoundBtn();
    if (this.save.picked) this._showMenu(); else this._beginMatchSetup();
  }

  // English is the base dictionary; French overrides it key by key, so a missing key never shows blank.
  Duel.prototype._dict = function () {
    var w = this.opts.wording || {}, en = w.duel || {};
    return this.lang === "fr" ? Object.assign({}, en, w.duelFr || {}) : en;
  };

  // ───────────────────────── DOM ─────────────────────────
  Duel.prototype._mount = function () {
    var root = document.createElement("div");
    root.className = "kr-duel";
    root.innerHTML =
      '<canvas class="kr-duel-canvas" role="img" aria-label="' + esc(this.t.canvasAria || "Duel court") + '"></canvas>' +
      '<div class="kr-duel-hud"><button class="kr-btn-icon kr-duel-exit" aria-label="' + esc(this.t.exit || "Exit") + '">✕</button>' +
      '<div class="kr-duel-score" aria-live="polite"></div><button class="kr-btn-icon kr-duel-sound" aria-pressed="false"></button></div>' +
      '<div class="kr-duel-banner" aria-live="polite"></div>' +
      '<button class="kr-duel-power" hidden></button>' +
      '<div class="kr-duel-coach" role="status" aria-live="polite" hidden></div>' +
      '<div class="kr-duel-panel"></div>';
    document.body.appendChild(root);
    this.root = root;
    this.canvas = root.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.scoreEl = root.querySelector(".kr-duel-score");
    this.bannerEl = root.querySelector(".kr-duel-banner");
    this.panelEl = root.querySelector(".kr-duel-panel");
    this.powerEl = root.querySelector(".kr-duel-power");
    this.coachEl = root.querySelector(".kr-duel-coach");
    this.soundEl = root.querySelector(".kr-duel-sound");

    var self = this;
    this._onResize = function () { self._resize(); };
    this._onKey = function (e) { self._key(e, true); };
    this._onKeyUp = function (e) { self._key(e, false); };
    this._onVis = function () { self.lastTs = 0; };
    window.addEventListener("resize", this._onResize);
    document.addEventListener("keydown", this._onKey);
    document.addEventListener("keyup", this._onKeyUp);
    document.addEventListener("visibilitychange", this._onVis);
    root.querySelector(".kr-duel-exit").addEventListener("click", function () { self.destroy(); });
    this.soundEl.addEventListener("click", function () { self._toggleSound(); });
    this.powerEl.addEventListener("click", function () { self._activatePower(); });
    this.panelEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-duel]");
      if (b) self._panelAction(b.getAttribute("data-duel"));
    });
    this.panelEl.addEventListener("keydown", function (e) {
      var tab = e.target.closest(".kr-duel-tab");
      if (!tab) return;
      var tabs = Array.from(self.panelEl.querySelectorAll(".kr-duel-tab"));
      var i = tabs.indexOf(tab);
      if (e.key === "ArrowLeft") i = (i + tabs.length - 1) % tabs.length;
      else if (e.key === "ArrowRight") i = (i + 1) % tabs.length;
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = tabs.length - 1;
      else return;
      e.preventDefault();
      self._panelAction(tabs[i].getAttribute("data-duel"));
      tabs[i].focus();
    });
    var c = this.canvas;
    c.addEventListener("pointerdown", function (e) { self._pDown(e); });
    c.addEventListener("pointermove", function (e) { self._pMove(e); });
    c.addEventListener("pointerup", function (e) { self._pUp(e); });
    c.addEventListener("pointercancel", function (e) { self._pUp(e, true); });
    this._resize();
    this.raf = requestAnimationFrame(function loop(ts) { self._frame(ts); self.raf = requestAnimationFrame(loop); });
  };

  Duel.prototype.destroy = function () {
    RNG = Math.random;
    this._clearScreenTimers();
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this._onResize);
    document.removeEventListener("keydown", this._onKey);
    document.removeEventListener("keyup", this._onKeyUp);
    document.removeEventListener("visibilitychange", this._onVis);
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    if (typeof this.opts.onExit === "function") this.opts.onExit();
  };

  // Sound is OFF until the player turns it on with the visible button (people play in clubs and locker rooms).
  Duel.prototype._sound = function (name) { try { if (this.save.sound && this.opts.sound) this.opts.sound(name); } catch (_) { } };

  Duel.prototype._toggleSound = function () {
    this.save.sound = !this.save.sound; writeSave(this.save);
    try { if (this.opts.setSound) this.opts.setSound(this.save.sound); } catch (_) { }
    this._updateSoundBtn();
    if (this.save.sound) this._sound("bounce");
  };

  Duel.prototype._updateSoundBtn = function () {
    var el = this.soundEl; if (!el) return;
    var on = !!this.save.sound;
    el.setAttribute("aria-pressed", on ? "true" : "false");
    el.setAttribute("aria-label", on ? (this.t.soundOn || "Sound on") : (this.t.soundOff || "Sound off"));
    el.textContent = on ? "\uD83D\uDD0A" : "\uD83D\uDD07";
  };

  // Short vibration (Android only; skipped for reduced motion). The UI decides if haptics are enabled.
  Duel.prototype._buzz = function (type) {
    try { if (this.opts.haptic && !(this.fx && this.fx.reduced)) this.opts.haptic(type); } catch (_) { }
  };

  Duel.prototype._track = function (name) { try { if (window.KR_Analytics) window.KR_Analytics.track(name); } catch (_) { } };

  Duel.prototype._opp = function () {
    if (this.daily) return LADDER[this.daily.idx];
    var base = LADDER[this._oppIdx()], extra = this._world() - 1;   // each new world: the same six + boss, tougher
    var level = DIFFICULTIES[this.save.difficulty], o = Object.assign({}, base);
    if (!extra && !this.save.coached && this.stage === 0) {
      o.speed *= 0.8; o.err *= 1.4; o.react *= 1.4; o.aggr *= 0.6;
    } else if (extra) {
      o.speed += extra * 1.2; o.err = Math.max(0.4, o.err - extra * 0.15);
      o.react = Math.max(0.07, o.react - extra * 0.02); o.pace *= 1 + extra * 0.05;
    }
    o.speed *= level.speed; o.react *= level.reaction; o.err *= level.error;
    return o;
  };

  // The ladder is one "world" long (6 opponents + the boss). Beating the boss starts the next, tougher world.
  Duel.prototype._oppIdx = function () { return this.daily ? this.daily.idx : this.stage % LADDER.length; };
  Duel.prototype._world = function () { return this.daily ? 1 : Math.floor(this.stage / LADDER.length) + 1; };

  // Court for the current match: the one you picked (if unlocked), else the one that goes with the ladder step.
  Duel.prototype._venueId = function () {
    if (this.daily) return AUTO[this.daily.idx % AUTO.length];
    var sel = this.save.venue;
    if (sel && sel !== "auto" && hasVenue(sel) && this.stage >= VENUES[sel].unlock) return sel;
    return AUTO[this.stage % AUTO.length];
  };

  Duel.prototype._difficultyHtml = function () {
    var t = this.t, current = this.save.difficulty;
    var labels = t.difficultyLevels || { relaxed: "Relaxed", standard: "Standard", challenge: "Challenge" };
    return '<div class="kr-duel-difficulty"><strong>' + esc(t.difficultyLabel || "Duel difficulty") + '</strong>' +
      '<div class="kr-duel-opts" role="group" aria-label="' + esc(t.difficultyLabel || "Duel difficulty") + '">' +
      Object.keys(DIFFICULTIES).map(function (id) {
        var selected = current === id;
        return '<button class="kr-duel-opt' + (selected ? ' kr-duel-opt--on' : '') + '" data-duel="difficulty-' + id +
          '" aria-pressed="' + selected + '">' + esc(labels[id]) + '</button>';
      }).join("") + '</div></div>';
  };

  Duel.prototype._showMenu = function (result, focusAction) {
    this._clearScreenTimers();
    this.phase = "menu";
    var t = this.t, opp = this._opp();
    var head = "";
    var sc = this._lastScore, fin = (result && sc) ? ' <span class="kr-duel-final">' + sc[0] + '\u2013' + sc[1] + '</span>' : "";
    if (result === "win") head = '<p class="kr-duel-result kr-duel-result--win">' + esc((this._lastBoss && t.bossWin) || t.win || "You win!") + fin + '</p>';
    if (result === "lose") head = '<p class="kr-duel-result kr-duel-result--lose">' + esc(t.lose || "So close. Run it back.") + fin + '</p>';
    if (result === "win" && this._lastBoss) head += '<p class="kr-muted">' + esc((t.worldUp || "World {w} unlocked: tougher opponents").replace("{w}", this._world())) + '</p>';
    if (result && this._lastEarn) head += '<p class="kr-duel-earn">' + esc((t.earned || "+{n} coins").replace("{n}", this._lastEarn)) + '</p>';
    var m = this.mode, s = this.side;
    function opt(id, label, on) { return '<button class="kr-duel-opt' + (on ? " kr-duel-opt--on" : "") + '" data-duel="' + id + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(label) + '</button>'; }
    var touch = this._isTouch;
    var tabs = ["play", "players", "courts", "progress"], tab = (this.tab && tabs.indexOf(this.tab) >= 0) ? this.tab : "play", tabNames = t.tabs || {};
    function tabBtn(id) {
      var selected = tab === id;
      return '<button role="tab" class="kr-duel-tab" id="kr-duel-tab-' + id + '" data-duel="tab-' + id +
        '" aria-controls="kr-duel-panel-' + id + '" aria-selected="' + selected + '" tabindex="' + (selected ? 0 : -1) +
        '">' + esc(tabNames[id] || id) + "</button>";
    }
    function panel(id, html) {
      return '<div class="kr-duel-tabpanel" role="tabpanel" id="kr-duel-panel-' + id + '" aria-labelledby="kr-duel-tab-' + id +
        '" data-tabpanel="' + id + '"' + (tab === id ? "" : " hidden") + ">" + html + "</div>";
    }
    this.panelEl.innerHTML =
      '<div class="kr-duel-card">' + head +
      '<p class="kr-duel-kicker">' + esc((this._world() > 1 && !this.daily ? (t.worldLabel || "World {w}").replace("{w}", this._world()) + " \u00b7 " : "") + (opp.boss ? (t.bossLabel || "FINAL BOSS") : (t.stageLabel || "Opponent {n}").replace("{n}", this._oppIdx() + 1))) + '</p>' +
      '<h2 class="kr-duel-name">' + esc(opp.name) + '</h2>' +
      '<p class="kr-muted">' + esc((t.tags && t.tags[this._oppIdx()]) || opp.tag || "") + '</p>' +
      (opp.trait && t.traits ? '<p class="kr-muted kr-duel-trait">' + esc((t.traitLabel || "Style: {x}").replace("{x}", t.traits[opp.trait] || "")) + '</p>' : "") +
      '<div class="kr-duel-tabs" role="tablist">' + tabs.map(tabBtn).join("") + '</div>' +
      panel("play", this._goalHtml(result) +
        '<div class="kr-duel-opts" role="group" aria-label="' + esc(t.modeAria || "Match type") + '">' +
          opt("singles", t.singles || "Singles", m === "singles") +
          opt("left", t.doublesLeft || "Doubles · Left", m === "doubles" && s === "left") +
          opt("right", t.doublesRight || "Doubles · Right", m === "doubles" && s === "right") +
        '</div>' + this._difficultyHtml() + this._dailyHtml() +
        '<button class="kr-btn kr-btn--secondary" data-duel="practice">' + esc(t.practiceTitle || "Drills") + '</button>' +
        '<button class="kr-btn kr-btn--ghost" data-duel="shop">' + esc(t.shopTitle || "Power shop") + '</button>' +
        '<p class="kr-duel-how">' + esc(touch ? (t.howTouch || "Drag to move. When time slows, swipe toward where you want the ball.") : (t.howKeys || "Arrows / WASD: move. When time slows, hold a direction and press Space, or click where you want the ball.")) + '</p>' +
        '<p class="kr-duel-how">' + esc(t.capsuleHint || "Grab the falling capsules for a short power.") + '</p>' +
        '<p class="kr-duel-how">' + esc(t.rules || "First to 5. Serve and return must bounce. No volleys in the Kitchen.") + '</p>' +
        '<button class="kr-btn kr-btn--ghost" data-duel="tutorial">' + esc(t.tutorialBtn || "Replay the tutorial") + '</button>') +
      panel("players", this._playerHtml() +
        '<button class="kr-btn kr-btn--ghost" data-duel="select">' + esc(t.selectOpen || "Open the select screen") + '</button>' +
        this._collectionHtml()) +
      panel("courts", this._venueHtml()) +
      panel("progress", this._progressHtml()) +
      '<button class="kr-btn kr-btn--primary kr-duel-go" data-duel="go">' + esc(result ? (result === "win" ? (t.next || "Next opponent") : (t.retry || "Rematch")) : (t.start || "Start match")) + '</button>' +
      '<button class="kr-btn kr-btn--ghost" data-duel="exit">' + esc(t.home || "Back to menu") + '</button>' +
      '<button class="kr-btn kr-btn--ghost kr-duel-lang" data-duel="lang" lang="' + (this.lang === "fr" ? "en" : "fr") + '">' + (this.lang === "fr" ? "English" : "Français") + '</button>' +
      '</div>';
    this.panelEl.classList.add("kr-duel-panel--on");
    this.scoreEl.textContent = "";
    this._setupActors();
    this._drawPortrait();
    var go = this.panelEl.querySelector(".kr-duel-go");
    var target = focusAction && Array.from(this.panelEl.querySelectorAll("[data-duel]:enabled")).find(function (b) {
      return b.getAttribute("data-duel") === focusAction && !b.closest("[hidden]");
    });
    target = target || go;
    if (target) try { target.focus({ preventScroll: true }); } catch (_) { }
  };

  // Progress block of the match menu: last results, record, goal for the next match, opponents beaten.
  Duel.prototype._goalHtml = function (result) {
    var t = this.t, opp = this._opp(), sc = this._lastScore, goal;
    if (result && this._lastDailyIdx != null && sc) goal = (t.dailyGoal || "Daily Duel: {you}–{them} vs {name}. Back tomorrow!").replace("{you}", sc[0]).replace("{them}", sc[1]).replace("{name}", LADDER[this._lastDailyIdx].name);
    else if (result === "lose" && sc) goal = (t.goalLose || "Lost {you}–{them}. Beat {name} to move up.").replace("{you}", sc[0]).replace("{them}", sc[1]).replace("{name}", opp.name);
    else if (result === "win") goal = (t.goalNext || "Next: beat {name}").replace("{name}", opp.name);
    else goal = (t.goalFirst || "Beat {name} to move up the ladder.").replace("{name}", opp.name);
    return '<p class="kr-duel-goal">' + esc(goal) + '</p>';
  };

  // Progress tab: recent results, record, win rate from the local playtest log, and the export button.
  Duel.prototype._progressHtml = function () {
    var t = this.t, sv = this.save, h = sv.history || [], wl = String(t.winLetter || "W"), ll = String(t.loseLetter || "L"), out = "";
    if (h.length) {
      out += '<div class="kr-duel-recent" role="list" aria-label="' + esc(t.recent || "Last matches") + '">' + h.slice(-5).map(function (e) {
        var w = e.you > e.them;
        return '<span role="listitem" class="kr-duel-dot kr-duel-dot--' + (w ? "w" : "l") + '" title="' + e.you + '–' + e.them + '">' + esc(w ? wl : ll) + '</span>';
      }).join("") + '</div>';
      out += '<p class="kr-muted">' + esc((t.record || "Wins {w} · Best margin +{m}").replace("{w}", Number(sv.wins) || 0).replace("{m}", sv.bestMargin || 0)) + '</p>';
    }
    var log = readStats();
    if (log.length) {
      var wins = log.filter(function (e) { return e.you > e.them; }).length, avg = Math.round(log.reduce(function (a, e) { return a + (Number(e.sec) || 0); }, 0) / log.length);
      out += '<p class="kr-muted">' + esc((t.winRate || "Win rate {p}% over {n} matches · avg {m}").replace("{p}", Math.round(100 * wins / log.length)).replace("{n}", log.length).replace("{m}", Math.floor(avg / 60) + ":" + (avg % 60 < 10 ? "0" : "") + (avg % 60))) + '</p>';
    } else out += '<p class="kr-muted">' + esc(t.noProgress || "Play a match to see your progress here.") + '</p>';
    out += '<button class="kr-btn kr-btn--secondary" data-duel="export">' + esc(t.exportBtn || "Copy my playtest data") + '</button>';
    return '<div class="kr-duel-stats">' + out + '</div>';
  };

  // Players tab: opponents beaten (a trophy shelf) and the character's super power.
  Duel.prototype._collectionHtml = function () {
    var t = this.t, sv = this.save;
    return '<div class="kr-duel-chips" aria-label="' + esc(t.collection || "Opponents beaten") + '">' + LADDER.map(function (o, i) {
      return (sv.beaten && sv.beaten[i]) ? '<span class="kr-duel-chip kr-duel-chip--on">\u2713 ' + esc(o.name) + '</span>' : '<span class="kr-duel-chip">?</span>';
    }).join("") + '</div>' + this._powerLine();
  };

  Duel.prototype._openTrainingPanel = function (html, focusAction) {
    this._clearScreenTimers();
    this.phase = "menu";
    this.panelEl.innerHTML = '<div class="kr-duel-card kr-duel-training">' + html + '</div>';
    this.panelEl.classList.add("kr-duel-panel--on");
    this.scoreEl.textContent = "";
    var target = focusAction && this.panelEl.querySelector('[data-duel="' + focusAction + '"]:enabled');
    (target || this.panelEl.querySelector("h2")).focus();
    if (!focusAction) this.panelEl.scrollTop = 0;
  };

  Duel.prototype._showPractice = function () {
    var t = this.t, sv = this.save;
    var names = t.drillNames || {}, goals = t.drillGoals || {}, levels = t.difficultyLevels || {};
    var html = '<h2 class="kr-duel-name" tabindex="-1">' + esc(t.practiceTitle || "Drills") + '</h2>';
    html += Object.keys(DRILLS).map(function (id) {
      var drill = DRILLS[id], best = sv.drillBests[id];
      var progress = (t.drillBest || "Best: {n}/{total}").replace("{n}", best).replace("{total}", DRILL_BALLS);
      var reward = best >= drill.goal ? (t.drillClaimed || "Reward earned") :
        (t.drillReward || "{n} tokens at {goal}/{total}").replace("{n}", drill.reward).replace("{goal}", drill.goal).replace("{total}", DRILL_BALLS);
      return '<article><strong>' + esc(names[id] || id) + '</strong><p>' + esc((levels[drill.difficulty] || drill.difficulty) + " · " + (goals[id] || "")) +
        '</p><p>' + esc(progress + " · " + reward) + '</p><button class="kr-btn kr-btn--secondary" data-duel="drill-' + id + '">' +
        esc(t.drillStart || "Practise") + '<span class="sr-only"> ' + esc(names[id] || id) + '</span></button></article>';
    }).join("");
    this._openTrainingPanel(html + '<button class="kr-btn kr-btn--ghost" data-duel="practice-back">' + esc(t.resultMenu || "Duel menu") + '</button>');
  };

  Duel.prototype._showShop = function (focusAction) {
    var t = this.t, sv = this.save, self = this;
    var html = '<h2 class="kr-duel-name" tabindex="-1">' + esc(t.shopTitle || "Power shop") + '</h2>' +
      '<p class="kr-duel-coins">' + esc((t.coins || "Rush Tokens: {n}").replace("{n}", sv.coins)) + '</p>' +
      '<p>' + esc(t.shopRule || "Equip one alternative super for classic Duel.") + '</p>' +
      '<button class="kr-btn kr-btn--secondary" data-duel="shop-native" aria-pressed="' + (!sv.shopPower) + '">' + esc(t.shopNative || "Character super") + '</button>';
    html += Object.keys(POWER_SHOP).map(function (id) {
      var cost = POWER_SHOP[id], owned = sv.powerLicenses[id], active = id === sv.shopPower;
      var afford = sv.coins >= cost;
      var label = active ? (t.playerEquipped || "Equipped") : owned ? (t.playerEquip || "Equip") :
        (afford ? (t.playerBuy || "Buy for {n} Rush Tokens") : (t.playerMissing || "Need {n} more Rush Tokens"))
          .replace("{n}", afford ? cost : cost - sv.coins);
      return '<article><strong>' + esc(self._powerName(id)) + '</strong><p>' + esc((t.powerDescs || [])[POWERS.indexOf(id)] || "") +
        '</p><button class="kr-btn kr-btn--secondary" data-duel="shop-power-' + id + '" aria-pressed="' + active + '"' +
        (!owned && sv.coins < cost ? ' disabled' : '') + '>' + esc(label) + '<span class="sr-only"> ' + esc(self._powerName(id)) + '</span></button></article>';
    }).join("");
    this._openTrainingPanel(html + '<button class="kr-btn kr-btn--ghost" data-duel="shop-back">' + esc(t.resultMenu || "Duel menu") + '</button>', focusAction);
  };

  Duel.prototype._chooseShopPower = function (id) {
    if (!Object.prototype.hasOwnProperty.call(POWER_SHOP, id)) return;
    var sv = this.save, cost = POWER_SHOP[id];
    if (!sv.powerLicenses[id]) {
      if (sv.coins < cost) return;
      sv.coins -= cost;
      sv.powerLicenses[id] = true;
    }
    sv.shopPower = id;
    writeSave(sv);
    this._showShop("shop-power-" + id);
  };

  Duel.prototype._drillTarget = function () {
    var cfg = DRILLS[this.drill.id], center = this.drill.id === "angle" ? (this.drill.attempts % 2 ? 6 : -6) : 0;
    return { left: center - cfg.halfWidth, right: center + cfg.halfWidth, near: cfg.y[0], far: cfg.y[1] };
  };

  Duel.prototype._drawDrillTarget = function (g) {
    var target = this._drillTarget(), self = this;
    var corners = [[target.left, target.near], [target.left, target.far], [target.right, target.far], [target.right, target.near]];
    g.save();
    g.beginPath();
    corners.forEach(function (corner, i) {
      var p = self._project(corner[0], corner[1], 0);
      if (i) g.lineTo(p.x, p.y);
      else g.moveTo(p.x, p.y);
    });
    g.closePath();
    g.fillStyle = "rgba(255,214,10,0.34)"; g.fill();
    g.strokeStyle = "#ffdf65"; g.lineWidth = 2.5; g.stroke();
    g.restore();
  };

  Duel.prototype._drillAttempt = function (hit) {
    if (this.phase !== "rally") return;
    if (this.ball) this.ball.live = false;
    this.phase = "point";
    this.phaseAt = this.now;
    this.drill.attempts += 1;
    if (hit) this.drill.hits += 1;
    this._updateScore();
    this._banner(hit ? (this.t.drillHit || "Target hit!") : (this.t.drillMiss || "Target missed"), 1300, hit ? "good" : "bad");
    this._sound(hit ? "milestone" : "fault");
  };

  Duel.prototype._finishDrill = function () {
    var round = this.drill, cfg = DRILLS[round.id], sv = this.save, t = this.t;
    var previous = sv.drillBests[round.id];
    var earn = previous < cfg.goal && round.hits >= cfg.goal ? cfg.reward : 0;
    sv.drillBests[round.id] = Math.max(previous, round.hits);
    sv.coins = clamp(sv.coins + earn, 0, 999999);
    writeSave(sv);
    this.drill = null;
    this._banner("", 0);
    var result = (t.drillResult || "Targets hit: {n}/{total}").replace("{n}", round.hits).replace("{total}", DRILL_BALLS);
    var title = (t.drillNames || {})[round.id] || (t.practiceTitle || "Drills");
    this._openTrainingPanel('<h2 class="kr-duel-name" tabindex="-1">' + esc(title) + '</h2>' + '<p>' + esc(result) + '</p>' +
      (earn ? '<p class="kr-duel-coins">' + esc((t.earned || "+{n} Rush Tokens").replace("{n}", earn)) + '</p>' : '') +
      '<button class="kr-btn kr-btn--primary" data-duel="drill-' + round.id + '">' + esc(t.retry || "Retry") + '</button>' +
      '<button class="kr-btn kr-btn--secondary" data-duel="practice">' + esc(t.practiceTitle || "Drills") + '</button>' +
      '<button class="kr-btn kr-btn--ghost" data-duel="shop">' + esc(t.shopTitle || "Power shop") + '</button>');
  };

  Duel.prototype._logMatch = function (won, s, isDaily) {
    var m = this._m || {}, all = readStats();
    all.push({ day: new Date().toISOString().slice(0, 10), v: String((window.KR_CONFIG && window.KR_CONFIG.version) || ""), stage: this.stage, world: this._world(), opp: this._opp().name,
      mode: isDaily ? "daily" : this.mode, you: s[0], them: s[1], sec: Math.round((Date.now() - (m.t0 || Date.now())) / 1000), maxRally: m.maxRally || 0, caps: m.caps || 0,
      powers: m.powers || 0, player: this._player().id, court: this._venueId(), src: (window.KR_Analytics && window.KR_Analytics.getSrc()) || "", pts: (m.pts || []).slice(0, 40) });
    writeStats(all.slice(-STATS_MAX));
  };

  Duel.prototype._exportData = function () {
    return JSON.stringify({ app: "kitchen-rush-duel", version: String((window.KR_CONFIG && window.KR_CONFIG.version) || ""), exportedAt: new Date().toISOString(), coins: this.save.coins || 0, stage: this.stage, matches: readStats() });
  };

  Duel.prototype._export = function () {
    var t = this.t, btn = this.panelEl.querySelector('[data-duel="export"]'), self = this;
    function done(ok) { if (btn) { btn.textContent = ok ? (t.exportDone || "Copied!") : (t.exportFail || "Copy failed"); setTimeout(function () { if (btn && self.root) btn.textContent = t.exportBtn || "Copy my playtest data"; }, 1800); } }
    try { navigator.clipboard.writeText(this._exportData()).then(function () { done(true); }, function () { done(false); }); } catch (_) { done(false); }
  };

  // Tutorial coach: one short hint at a time during the first match.
  Duel.prototype._coachTick = function () {
    var el = this.coachEl; if (!el) return;
    var t = this.t, key = "", b = this.ball;
    if (this.phase !== "menu" && !this.daily && !this.drill && !this.save.coached) {
      if (this._guidedReturn && this.phase === "serve") key = "coachReturn";
      else if (this.phase === "serve" && this.server === this.human) key = "coachServe";
      else if (this.phase === "rally" && this.timeScale < 0.7) key = "coachAim";
      else if (this.phase === "rally" && b && b.live && !b.dead && b.lastHitTeam === 1) key = "coachMove";
      else if (this.phase === "rally" && b && b.lastHitTeam === 0) key = "coachNice";
    }
    if (this.phase === "rally" && this.now < this._shotFeedbackUntil && this._shotFeedback) key = this._shotFeedback;
    if (this.phase === "rally" && this.now < (this._coachSuccessUntil || 0)) key = "coachFirstReturn";
    if (key === this._coachKey) return;
    this._coachKey = key;
    if (!key) { el.hidden = true; return; }
    el.textContent = t[key + (this._isTouch ? "Touch" : "Keys")] || t[key] || "";
    el.hidden = !el.textContent;
  };

  // ───────────────────────── Powers ─────────────────────────
  // The player you picked (Alex in the Daily Duel, so everyone plays on equal terms).
  Duel.prototype._player = function () {
    if (this.daily || this.drill) return DAILY_PLAYER;
    var id = this.save.player, sv = this.save;
    for (var i = 0; i < PLAYERS.length; i++) if (PLAYERS[i].id === id && (PLAYERS[i].cost === 0 || (sv.owned && sv.owned[id]))) return PLAYERS[i];
    return PLAYERS[0];
  };
  Duel.prototype._pname = function (p) {
    var cfg = window.KR_CONFIG, fun = !!(cfg && cfg.duelNames === "fun");
    return (fun && ROSTER.fun[this.lang === "fr" ? "fr" : "en"][p.id]) || ROSTER.neutral[p.id] || p.id;
  };
  // Look per edition. With duelNames "fun" a character may carry an "inspired" look (`lookFun`, same shape as `look`: hair style, hair colour,
  // skin; generic cartoon traits only, never a portrait). Until the owner supplies those traits, `lookFun` is absent and `look` is used.
  Duel.prototype._plook = function (p) {
    if (!p) return null;
    var l = this.lang === "fr" ? "fr" : "en", cfg = window.KR_CONFIG;
    var base = (p.look && p.look[l]) || null, fun = !!(cfg && cfg.duelNames === "fun") && p.lookFun && p.lookFun[l];
    return fun ? Object.assign({}, base || {}, fun) : base;   // missing traits (unverified) keep the generic value
  };
  Duel.prototype._pstat = function (k) { return (this._player().stats && this._player().stats[k]) || 1; };
  Duel.prototype._chargeMax = function () { return this._player().chargeNeed || CHARGE_MAX; };
  Duel.prototype._capDelay = function (s) { return s * (this._player().lucky ? 0.6 : 1); };

  Duel.prototype._playerHtml = function () {
    var t = this.t, sv = this.save, cur = this._player(), sk = t.playerSkill || {}, coins = sv.coins || 0;
    var pid = this.previewPlayer || cur.id, P = cur;
    PLAYERS.forEach(function (p) { if (p.id === pid) P = p; });
    var self = this, chips = PLAYERS.map(function (p) {
      var owned = p.cost === 0 || !!(sv.owned && sv.owned[p.id]), a = p.pal.jerseyA || HUMAN_PAL.jerseyA, b = p.pal.jerseyB || HUMAN_PAL.jerseyB;
      return '<button class="kr-duel-chip' + (cur.id === p.id ? " kr-duel-chip--eq" : "") + (P.id === p.id ? " kr-duel-chip--pick" : "") + '" data-duel="pl-' + p.id + '" aria-pressed="' + (P.id === p.id ? "true" : "false") + '"><i class="kr-duel-swatch" style="background:linear-gradient(135deg,' + a + "," + b + ')"></i>' + esc(self._pname(p)) + (owned ? "" : " · " + p.cost) + "</button>";
    }).join("");
    var owned = P.cost === 0 || !!(sv.owned && sv.owned[P.id]), equipped = cur.id === P.id, afford = coins >= P.cost;
    var label = equipped ? (t.playerEquipped || "Equipped") : owned ? (t.playerEquip || "Equip") : afford ? (t.playerBuy || "Buy for {n} coins").replace("{n}", P.cost) : (t.playerMissing || "Need {n} more coins").replace("{n}", P.cost - coins);
    return '<p class="kr-duel-coins">' + esc((t.coins || "Coins: {n}").replace("{n}", coins)) + "</p>" +
      '<div class="kr-duel-venues" role="group" aria-label="' + esc(t.playerLabel || "My player") + '">' + chips + "</div>" +
      '<div class="kr-duel-detail"><canvas class="kr-duel-portrait" width="180" height="200" aria-hidden="true" data-portrait="' + P.id + '"></canvas><strong>' + esc(this._pname(P)) + '</strong><p class="kr-muted">' + esc(sk[P.id] || "") + '</p>' +
      '<button class="kr-btn kr-btn--secondary" data-duel="act-' + P.id + '"' + ((equipped || (!owned && !afford)) ? " disabled" : "") + ">" + esc(label) + "</button></div>";
  };

  // Front-view portraits: canvases with data-portrait="<player id>" (a character) or data-opp="1" (the current opponent).
  Duel.prototype._paintPortraits = function () {
    if (!this.panelEl || !window.KR_CHARACTERS) return;
    var self = this;
    this.panelEl.querySelectorAll("canvas[data-portrait], canvas[data-opp]").forEach(function (cv) {
      var g = cv.getContext("2d"); if (!g) return;
      g.clearRect(0, 0, cv.width, cv.height);
      var pal, role = "player";
      if (cv.hasAttribute("data-opp")) { var o = self._opp(); pal = Object.assign({}, o.pal, LOOKS[o.look % LOOKS.length]); role = "opponent"; }
      else {
        var id = cv.getAttribute("data-portrait"), P = PLAYERS[0];
        PLAYERS.forEach(function (p) { if (p.id === id) P = p; });
        pal = Object.assign({}, HUMAN_PAL, LOOKS[self.look], P.pal, self._plook(P) || {});
      }
      window.KR_CHARACTERS.draw(g, { x: cv.width * 0.45, y: cv.height * 0.75, scale: cv.width / 62, now: 0, state: "idle", side: 1, facing: "front", role: role, palette: pal, lookX: 0 });
    });
  };
  Duel.prototype._drawPortrait = Duel.prototype._paintPortraits;

  // ───────────────────────── Fighting-game screens: select, versus, victory ─────────────────────────
  Duel.prototype._clearScreenTimers = function () {
    if (this._versusT) { clearTimeout(this._versusT); this._versusT = 0; }
    if (this._splashT) { clearTimeout(this._splashT); this._splashT = 0; }
  };

  Duel.prototype._buyOrEquip = function (pid) {
    var sv = this.save, P = null;
    for (var i = 0; i < PLAYERS.length; i++) if (PLAYERS[i].id === pid) P = PLAYERS[i];
    if (!P) return;
    if (P.cost === 0 || sv.owned[pid]) sv.player = pid;
    else if ((sv.coins || 0) >= P.cost) { sv.coins -= P.cost; sv.owned[pid] = true; sv.player = pid; this._sound("milestone"); }
    this.previewPlayer = pid; writeSave(sv);
  };

  Duel.prototype._beginMatchSetup = function () {
    this.daily = null;
    this.matchSetup = true;
    this.previewPlayer = null;
    this.previewVenue = this.save.venue || "auto";
    this._showSelect();
  };

  Duel.prototype._setupSteps = function (step) {
    var t = this.t;
    var labels = [t.setupStepPlayer || "Player", t.venueLabel || "Court", t.setupStepMatch || "Match"];
    return '<ol class="kr-duel-steps">' + labels.map(function (label, i) {
      return '<li' + (i === step ? ' aria-current="step"' : '') + '>' + esc(label) + '</li>';
    }).join("") + '</ol>';
  };

  // Character select: a roster of 6 tiles, a big preview with the super power, then Continue.
  Duel.prototype._showSelect = function (focusAction) {
    this._clearScreenTimers();
    this.phase = "menu";
    var t = this.t, sv = this.save, cur = this._player(), self = this, coins = sv.coins || 0, sk = t.playerSkill || {};
    var P = cur; PLAYERS.forEach(function (p) { if (p.id === (self.previewPlayer || cur.id)) P = p; });
    var tiles = PLAYERS.map(function (p) {
      var owned = p.cost === 0 || !!(sv.owned && sv.owned[p.id]), on = P.id === p.id;
      return '<button class="kr-duel-tile' + (on ? " kr-duel-tile--on" : "") + (owned ? "" : " kr-duel-tile--locked") + '" data-duel="sel-' + p.id + '" aria-pressed="' + (on ? "true" : "false") + '">' +
        '<canvas width="70" height="78" aria-hidden="true" data-portrait="' + p.id + '"></canvas>' +
        '<span class="kr-duel-tile-name">' + esc(self._pname(p)) + '</span>' +
        '<span class="kr-duel-tile-sub">' + esc(cur.id === p.id ? "\u2605" : owned ? "" : "\uD83E\uDE99 " + p.cost) + '</span></button>';
    }).join("");
    var owned = P.cost === 0 || !!(sv.owned && sv.owned[P.id]), equipped = cur.id === P.id, afford = coins >= P.cost;
    var label = equipped ? (t.playerEquipped || "Equipped") : owned ? (t.playerEquip || "Equip") : afford ? (t.playerBuy || "Buy for {n} coins").replace("{n}", P.cost) : (t.playerMissing || "Need {n} more coins").replace("{n}", P.cost - coins);
    var pi = POWERS.indexOf(P.sup);
    var sup = (t.superLine || "Super: {name} \u2014 {desc}").replace("{name}", this._powerName(P.sup)).replace("{desc}", (t.powerDescs || [])[pi] || "");
    this.panelEl.innerHTML =
      '<div class="kr-duel-card kr-duel-select" role="group" aria-label="' + esc(t.selectTitle || "Choose your player") + '">' +
      (this.matchSetup ? this._setupSteps(0) : '') +
      '<h2 class="kr-duel-name" tabindex="-1">' + esc(t.selectTitle || "Choose your player") + '</h2>' +
      '<p class="kr-duel-coins">' + esc((t.coins || "Coins: {n}").replace("{n}", coins)) + '</p>' +
      '<div class="kr-duel-hero" style="--duel-player-color:' + P.pal.jerseyB + '"><canvas width="240" height="260" aria-hidden="true" data-portrait="' + P.id + '"></canvas><div class="kr-duel-hero-info">' +
      '<strong class="kr-duel-hero-name">' + esc(this._pname(P)) + '</strong>' +
      '<p class="kr-duel-super">' + esc(sup) + '</p>' +
      '<p class="kr-muted">' + esc(sk[P.id] || "") + '</p>' +
      (this.matchSetup && equipped ? '<p class="kr-duel-equipped">' + esc(label) + '</p>' :
        '<button class="kr-btn kr-btn--secondary" data-duel="selact-' + P.id + '"' + ((equipped || (!owned && !afford)) ? " disabled" : "") + '>' + esc(label) + '</button>') + '</div></div>' +
      '<div class="kr-duel-roster" role="group" aria-label="' + esc(t.playerLabel || "My player") + '">' + tiles + '</div>' +
      (this.matchSetup && sv.shopPower ? this._powerLine() : '') +
      (this.matchSetup ? this._difficultyHtml() : '') +
      '<button class="kr-btn kr-btn--primary kr-duel-go" data-duel="selok"' + (this.matchSetup && !equipped ? ' disabled' : '') + '>' + esc(this.matchSetup ? (t.setupNextCourt || "Choose court") : (t.selectOk || "Continue")) + '</button>' +
      (this.matchSetup ? '<button class="kr-btn kr-btn--ghost" data-duel="setup-cancel">' + esc(t.home || "Back to menu") + '</button>' : '') + '</div>';
    this.panelEl.classList.add("kr-duel-panel--on");
    this.scoreEl.textContent = "";
    this._setupActors();
    this._paintPortraits();
    var target = focusAction && this.panelEl.querySelector('[data-duel="' + focusAction + '"]:enabled');
    target = target || this.panelEl.querySelector("h2");
    if (!focusAction) this.panelEl.scrollTop = 0;
    if (target) try { target.focus({ preventScroll: true }); } catch (_) { }
  };

  Duel.prototype._showCourtSelect = function (focusAction) {
    var t = this.t, self = this, names = t.venues || {}, selected = this.previewVenue;
    var current = selected === "auto" ? AUTO[this.stage % AUTO.length] : selected;
    var cards = ["auto"].concat(VENUE_ORDER).map(function (id) {
      var actual = id === "auto" ? AUTO[self.stage % AUTO.length] : id;
      var locked = id !== "auto" && self.stage < VENUES[id].unlock;
      var name = id === "auto" ? (t.venueAuto || "Auto") + " · " + (names[actual] || actual) : (names[id] || id);
      var note = locked ? (t.venueLocked || "Reach opponent {n} to unlock").replace("{n}", VENUES[id].unlock + 1) : "";
      return '<button class="kr-duel-tile' + (selected === id ? ' kr-duel-tile--on' : '') +
        '" data-duel="court-' + id + '" aria-pressed="' + (selected === id) + '"' + (locked ? ' disabled' : '') + '>' +
        '<canvas width="144" height="96" aria-hidden="true" data-court-preview="' + actual + '"></canvas>' +
        '<span class="kr-duel-tile-name">' + esc(name) + '</span>' +
        (note ? '<span class="kr-duel-tile-sub">' + esc(note) + '</span>' : '') + '</button>';
    }).join("");
    this.panelEl.innerHTML =
      '<div class="kr-duel-card kr-duel-select">' + this._setupSteps(1) +
      '<h2 class="kr-duel-name" tabindex="-1">' + esc(t.setupCourtTitle || "Choose a court") + '</h2>' +
      '<figure class="kr-duel-court-hero"><canvas width="480" height="240" aria-hidden="true" data-court-preview="' + current + '"></canvas>' +
      '<figcaption>' + esc(names[current] || current) + '</figcaption></figure>' +
      '<div class="kr-duel-roster kr-duel-court-roster" role="group" aria-label="' + esc(t.venueLabel || "Court") + '">' + cards + '</div>' +
      '<button class="kr-btn kr-btn--primary" data-duel="court-ok">' + esc(t.setupNextMatch || "See the matchup") + '</button>' +
      '<button class="kr-btn kr-btn--ghost" data-duel="setup-back">' + esc(t.setupBackPlayer || "Back to player selection") + '</button></div>';
    if (!focusAction) this.panelEl.scrollTop = 0;
    var previews = {};
    this.panelEl.querySelectorAll("[data-court-preview]").forEach(function (canvas) {
      var id = canvas.getAttribute("data-court-preview");
      var preview = previews[id] || (previews[id] = self._drawBackground(id));
      var g = canvas.getContext("2d");
      if (!g) return;
      var ratio = Math.max(canvas.width / preview.width, canvas.height / preview.height);
      var width = preview.width * ratio, height = preview.height * ratio;
      g.drawImage(preview, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    });
    var target = focusAction && this.panelEl.querySelector('[data-duel="' + focusAction + '"]');
    (target || this.panelEl.querySelector("h2")).focus();
  };

  // "VS" screen before every match; a tap, Enter or Space skips it, otherwise it moves on by itself.
  Duel.prototype._showVersus = function () {
    this._clearScreenTimers();
    this.phase = "menu";
    var t = this.t, opp = this._opp(), self = this, me = this._player(), mine = this.daily ? PLAYERS[0] : me;
    var court = (t.venues || {})[this._venueId()] || "";
    var reduced = false; try { reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (_) { }
    this.panelEl.innerHTML =
      '<div class="kr-duel-card kr-duel-versus-card">' + (this.daily ? '' : this._setupSteps(2)) + '<button class="kr-duel-versus" data-duel="versus-go">' +
      '<span class="kr-duel-vs-side kr-duel-vs-side--l"><canvas width="150" height="168" aria-hidden="true" data-portrait="' + mine.id + '"></canvas><strong>' + esc(this._pname(mine)) + '</strong></span>' +
      '<span class="kr-duel-vs-mid" aria-hidden="true">' + esc(t.versusVs || "VS") + '</span>' +
      '<span class="kr-duel-vs-side kr-duel-vs-side--r"><canvas width="150" height="168" aria-hidden="true" data-opp="1"></canvas><strong>' + esc(opp.name) + '</strong></span>' +
      '<span class="kr-duel-vs-foot">' + esc(court) + '</span>' +
      '<span class="kr-btn kr-btn--primary kr-duel-vs-action">' + esc(t.start || "Start match") + '</span></button></div>';
    this.panelEl.classList.add("kr-duel-panel--on");
    this._setupActors();
    this._paintPortraits();
    this._sound("milestone");
    var b = this.panelEl.querySelector(".kr-duel-versus"); if (b) try { b.focus({ preventScroll: true }); } catch (_) { }
    if (this.daily) this._versusT = setTimeout(function () { self._versusT = 0; if (self.root && self.phase === "menu") self._startMatch(); }, reduced ? 900 : 1900);
  };

  // Short victory (or defeat) splash after a match, then the menu.
  Duel.prototype._showSplash = function (result) {
    this._clearScreenTimers();
    var t = this.t, won = result === "win", sc = this._lastScore, daily = this._lastDailyIdx != null;
    var title = won ? (this._lastBoss ? (t.splashBoss || "BOSS DEFEATED!") : (t.splashWin || "VICTORY!")) : (t.splashLose || "Not this time");
    var me = this._player();
    var next = won ? (t.next || "Next opponent") : (t.retry || "Rematch");
    var note = won ? (t.nextRival || "Next: {name}").replace("{name}", this._opp().name) : (t.retryTips || {})[this._lastFault] || "";
    this.panelEl.innerHTML =
      '<div class="kr-duel-card kr-duel-splash-card"><div class="kr-duel-splash kr-duel-splash--' + (won ? "win" : "lose") + '">' +
      '<span class="kr-duel-splash-title">' + esc(title) + '</span>' +
      '<canvas width="150" height="168" aria-hidden="true" data-portrait="' + me.id + '"></canvas>' +
      '<span class="kr-duel-splash-score">' + (sc ? sc[0] + '\u2013' + sc[1] : "") + (this._lastEarn ? " \u00b7 " + esc((t.earned || "+{n} coins").replace("{n}", this._lastEarn)) : "") + '</span></div>' +
      (!daily && note ? '<p class="kr-duel-result-note">' + esc(note) + '</p>' : '') +
      (!daily ? '<button class="kr-btn kr-btn--primary" data-duel="splash-next">' + esc(next) + '</button>' : '') +
      '<button class="kr-btn ' + (daily ? 'kr-btn--primary' : 'kr-btn--ghost') + '" data-duel="splash-go">' +
      esc(daily ? (t.selectOk || "Continue") : (t.resultMenu || "Duel menu")) + '</button></div>';
    this.panelEl.classList.add("kr-duel-panel--on");
    this._paintPortraits();
    this.panelEl.scrollTop = 0;
    this.panelEl.querySelector(".kr-btn--primary").focus({ preventScroll: true });
  };

  Duel.prototype._pw = function (key) {
    var p = this.power;
    if (!p || this.now >= p.until) return false;
    return key === "any" || p.key === key;
  };

  // The super power is the character's own (none in the Daily Duel).
  Duel.prototype._equippedKey = function () {
    if (this.daily || this.drill) return "";
    return this.save.shopPower || this._player().sup || "";
  };

  Duel.prototype._powerName = function (key) { var i = POWERS.indexOf(key); return (this.t.powerNames || [])[i] || key; };

  Duel.prototype._powerLine = function () {
    var t = this.t, key = this._equippedKey();
    if (!key) return '<p class="kr-muted kr-duel-powerline">' + esc(t.powerNone || "Win points and catch capsules to charge your super power.") + '</p>';
    var i = POWERS.indexOf(key);
    return '<p class="kr-muted kr-duel-powerline">' + esc((t.powerEquip || "Power: {name} \u2014 {desc}").replace("{name}", this._powerName(key)).replace("{desc}", (t.powerDescs || [])[i] || "")) + '</p>';
  };

  Duel.prototype._activatePower = function () {
    var key = this._equippedKey();
    if (!key || this.daily || this.phase === "menu" || (this.charge || 0) < this._chargeMax() || this._pw("any")) return;
    if (this._m) this._m.powers++;
    this.power = { key: key, until: this.now + POWER_SECONDS };
    this.charge = 0;
    this.flashUntil = this.now + 0.3; this._flashKey = key;
    if (this.fx) this.fx.punch(0.03, this.now * 1000);
    this._sound("milestone");
    this._banner(this._powerName(key) + "!", 900, "good");
    var p = this._project(this.human.x, this.human.y, 2);
    if (this.fx) { this.fx.burst(p.x, p.y, ["#ffd60a", "#ffffff", "#3fd0ff"], 16, { speed: 300, up: 90 }); this.fx.ring(p.x, p.y, "#ffd60a", 60); }
  };

  // Small HUD button: charge, ready (tap/E to fire) or active countdown. Re-rendered only when the text changes.
  Duel.prototype._powerHud = function () {
    var el = this.powerEl; if (!el) return;
    var act = this._pw("any");
    if (this._wasPw && !act && this.fx && this.human) { var q = this._project(this.human.x, this.human.y, 0); this.fx.ring(q.x, q.y, "rgb(" + POWER_RGB[this._wasPw] + ")", 56, 520); }
    this._wasPw = act ? this.power.key : "";
    var key = this._equippedKey();
    if (!key || this.daily || this.phase === "menu") { if (this._phs !== "hide") { el.hidden = true; this._phs = "hide"; } return; }
    var t = this.t, name = this._powerName(key), state, txt;
    if (this._pw("any")) { state = "on"; txt = (t.powerActive || "{name} {s}s").replace("{name}", name).replace("{s}", Math.max(1, Math.ceil(this.power.until - this.now))); }
    else if ((this.charge || 0) >= this._chargeMax()) { state = "ready"; txt = (t.powerReady || "{name} READY").replace("{name}", name); }
    else { state = "charge"; txt = (t.powerCharge || "{name} {n}/{m}").replace("{name}", name).replace("{n}", this.charge || 0).replace("{m}", this._chargeMax()); }
    var sig = state + "|" + txt;
    if (sig === this._phs) return;
    this._phs = sig; el.style.setProperty("--pw", "rgb(" + POWER_RGB[key] + ")"); el.hidden = false; el.textContent = txt; el.disabled = state !== "ready";
    el.className = "kr-duel-power kr-duel-power--" + state;
  };

  Duel.prototype._dailyHtml = function () {
    var t = this.t, di = dailyInfo(), d = this.save.daily;
    if (d && d.key === di.key) {
      var line = (t.dailyDone || "Daily Duel today: {you}\u2013{them} vs {name}").replace("{you}", d.you).replace("{them}", d.them).replace("{name}", LADDER[d.idx % LADDER.length].name);
      return '<p class="kr-muted kr-duel-daily-line">' + esc(line) + '</p>' +
        '<button class="kr-btn kr-btn--secondary kr-duel-share" data-duel="share">' + esc(t.share || "Share") + '</button>' +
        '<button class="kr-btn kr-btn--ghost" data-duel="card">' + esc(t.saveImage || "Save image") + '</button>';
    }
    return '<button class="kr-btn kr-btn--secondary kr-duel-daily" data-duel="daily">' + esc((t.dailyBtn || "Daily Duel \u00b7 vs {name}").replace("{name}", LADDER[di.idx].name)) + '</button>';
  };

  // Today's result as an image (Web Share with files when available) with a text fallback; no personal data.
  var SHARE_BONUS = 10;

  Duel.prototype._cardOpts = function () {
    var di = dailyInfo(), d = this.save.daily;
    if (!d || d.key !== di.key) return null;
    return { lang: this.lang, you: d.you, them: d.them, name: LADDER[d.idx % LADDER.length].name, date: d.key, urlText: location.host + location.pathname.replace(/index\.html$/, "") };
  };

  Duel.prototype._shareReward = function () {
    var sv = this.save, day = dailyInfo().key, t = this.t;
    this._track("daily-share");
    if (sv.shareDay === day) return;
    sv.shareDay = day; sv.coins = clamp((Number(sv.coins) || 0) + SHARE_BONUS, 0, 999999); writeSave(sv);
    var btn = this.panelEl.querySelector('[data-duel="share"]'), self = this;
    if (btn) { btn.textContent = (t.shareBonus || "+{n} coins for sharing!").replace("{n}", SHARE_BONUS); setTimeout(function () { if (btn && self.root) btn.textContent = t.share || "Share"; }, 2200); }
  };

  Duel.prototype._share = function () {
    var o = this._cardOpts(); if (!o) return;
    var t = this.t, self = this;
    var link = location.origin + location.pathname + "?lang=" + this.lang;
    var text = (t.shareText || "Kitchen Rush Daily Duel {date}: {you}–{them} vs {name}").replace("{date}", o.date).replace("{you}", o.you).replace("{them}", o.them).replace("{name}", o.name) + "\n" + link;
    var btn = this.panelEl.querySelector('[data-duel="share"]');
    function done(ok) { if (btn) { btn.textContent = ok ? (t.copied || "Copied!") : (t.copyFailed || "Copy failed"); setTimeout(function () { if (btn && self.root) btn.textContent = t.share || "Share"; }, 1600); } }
    function textFlow() {
      try {
        if (navigator.share) { navigator.share({ text: text }).then(function () { self._shareReward(); }, function () { }); return; }
        navigator.clipboard.writeText(text).then(function () { done(true); self._shareReward(); }, function () { done(false); });
      } catch (_) { done(false); }
    }
    if (window.KR_CARD && window.KR_CARD.share) {
      window.KR_CARD.share(o, text).then(function (r) { if (r === "shared") self._shareReward(); else if (r !== "cancelled") textFlow(); }, textFlow);
    } else textFlow();
  };

  Duel.prototype._saveCard = function () {
    var o = this._cardOpts(); if (!o || !window.KR_CARD) return;
    window.KR_CARD.download(o);
  };

  Duel.prototype._panelAction = function (a) {
    if (a === "exit") { this.destroy(); return; }
    if (a === "practice") { this._showPractice(); return; }
    if (a === "shop") { this._showShop(); return; }
    if (a === "practice-back") { this.tab = "play"; this._showMenu(this._lastResult, "practice"); return; }
    if (a === "shop-back") { this.tab = "play"; this._showMenu(this._lastResult, "shop"); return; }
    if (a === "shop-native") { this.save.shopPower = ""; writeSave(this.save); this._showShop(a); return; }
    if (a.indexOf("shop-power-") === 0) { this._chooseShopPower(a.slice(11)); return; }
    if (a.indexOf("drill-") === 0) {
      var id = a.slice(6);
      if (Object.prototype.hasOwnProperty.call(DRILLS, id)) {
        this.daily = null;
        this.drill = { id: id, attempts: 0, hits: 0 };
        this._startMatch();
      }
      return;
    }
    if (a.indexOf("pl-") === 0) { this.previewPlayer = a.slice(3); this._showMenu(this._lastResult, a); return; }
    if (a.indexOf("act-") === 0) { var pid = a.slice(4); this._buyOrEquip(pid); this._showMenu(this._lastResult, "pl-" + pid); return; }
    if (a.indexOf("sel-") === 0) {
      var previewId = a.slice(4);
      this.previewPlayer = previewId;
      if (this.matchSetup && (previewId === PLAYERS[0].id || this.save.owned[previewId])) this._buyOrEquip(previewId);
      this._showSelect(a);
      return;
    }
    if (a.indexOf("selact-") === 0) { var sid = a.slice(7); this._buyOrEquip(sid); this._showSelect("sel-" + sid); return; }
    if (a === "selok") {
      if (this.matchSetup && this.previewPlayer && this.previewPlayer !== this._player().id) return;
      this.save.picked = true;
      writeSave(this.save);
      if (this.matchSetup) this._showCourtSelect();
      else this._showMenu(this._lastResult, "select");
      return;
    }
    if (a.indexOf("difficulty-") === 0) {
      var difficulty = a.slice(11);
      if (!Object.prototype.hasOwnProperty.call(DIFFICULTIES, difficulty)) return;
      this.save.difficulty = difficulty; writeSave(this.save);
      if (this.matchSetup) this._showSelect(a);
      else this._showMenu(this._lastResult, a);
      return;
    }
    if (a === "setup-cancel") { this.matchSetup = false; this._showMenu(this._lastResult); return; }
    if (a === "setup-back") { this._showSelect(); return; }
    if (a === "court-ok") {
      this.save.venue = this.previewVenue;
      writeSave(this.save);
      this.matchSetup = false;
      this._showVersus();
      return;
    }
    if (a.indexOf("court-") === 0) {
      var courtId = a.slice(6);
      if (courtId === "auto" || (hasVenue(courtId) && this.stage >= VENUES[courtId].unlock)) {
        this.previewVenue = courtId;
        this._showCourtSelect(a);
      }
      return;
    }
    if (a === "select") { this.previewPlayer = null; this._showSelect(); return; }
    if (a === "versus-go") { this._clearScreenTimers(); this._startMatch(); return; }
    if (a === "splash-next") {
      if (this._lastDailyIdx != null) return;
      if (this._lastResult === "win") this._beginMatchSetup();
      else if (this._lastResult === "lose") this._startMatch();
      return;
    }
    if (a === "splash-go") { this._clearScreenTimers(); this._showMenu(this._lastResult); return; }
    if (a === "tutorial") { this.save.coached = false; writeSave(this.save); this.tab = "play"; this._showMenu(this._lastResult); return; }
    if (a === "export") { this._export(); return; }
    if (a.indexOf("tab-") === 0) {
      var tb = a.slice(4);
      if (["play", "players", "courts", "progress"].indexOf(tb) < 0) return;
      this.tab = tb;
      this.panelEl.querySelectorAll("[data-tabpanel]").forEach(function (p) { p.hidden = p.getAttribute("data-tabpanel") !== tb; });
      this.panelEl.querySelectorAll(".kr-duel-tab").forEach(function (b) {
        var selected = b.getAttribute("data-duel") === "tab-" + tb;
        b.setAttribute("aria-selected", selected ? "true" : "false");
        b.tabIndex = selected ? 0 : -1;
      });
      return;
    }
    if (a.indexOf("venue-") === 0) {
      var vid = a.slice(6);
      if (vid === "auto" || (hasVenue(vid) && this.stage >= VENUES[vid].unlock)) { this.save.venue = vid; writeSave(this.save); this._bg = null; this.venueMsg = ""; }
      else if (hasVenue(vid)) this.venueMsg = (this.t.venueLocked || "Reach opponent {n} to unlock").replace("{n}", VENUES[vid].unlock + 1);
      this._showMenu(this._lastResult, a); return;
    }
    if (a === "go") { this._beginMatchSetup(); return; }
    if (a === "daily") { var di = dailyInfo(); this.daily = di; this.mode = "singles"; this._showVersus(); return; }
    if (a === "share") { this._share(); return; }
    if (a === "card") { this._saveCard(); return; }
    if (a === "lang") { this.lang = this.lang === "fr" ? "en" : "fr"; this.save.lang = this.lang; this.t = this._dict(); this._bg = null; }
    else if (a === "look") this.look = (this.look + 1) % LOOKS.length;
    else if (a === "singles") this.mode = "singles";
    else { this.mode = "doubles"; this.side = a; }
    this.save.mode = this.mode; this.save.side = this.side; this.save.look = this.look; writeSave(this.save);
    this._showMenu(this._lastResult, a);
  };

  // ───────────────────────── Match setup ─────────────────────────
  Duel.prototype._setupActors = function () {
    var opp = this._opp(), dbl = !this.drill && this.mode === "doubles";
    var hx = dbl ? (this.side === "left" ? -5 : 5) : 0;
    function actor(team, human, hx0, hy0, skill, pal, zone) {
      return { team: team, human: human, x: hx0, y: hy0, homeX: hx0, homeY: hy0, vx: 0, vy: 0, skill: skill, pal: pal, zone: zone,
        swingAnim: 0, swingUntil: 0, aimX: 0, aimY: 0, goalX: hx0, goalY: hy0, reactAt: 0, planId: -1, leave: false, side: 1 };
    }
    var A = [];
    var oppPal = Object.assign({}, opp.pal, LOOKS[opp.look % LOOKS.length]);
    var humanPal = Object.assign({}, HUMAN_PAL, LOOKS[this.look], this._player().pal, this._plook(this._player()) || {});
    var allyLook = LOOKS[(this.look + 3) % LOOKS.length];
    this.human = actor(0, true, hx, -15, null, humanPal, dbl ? (hx < 0 ? [-99, 0] : [0, 99]) : [-99, 99]);
    A.push(this.human);
    if (dbl) A.push(actor(0, false, -hx, -15, ALLY, Object.assign({}, ALLY.pal, allyLook), hx < 0 ? [0, 99] : [-99, 0]));
    if (dbl) {
      var partner = opp.boss ? LADDER[5] : opp;
      var pal2 = Object.assign({}, partner.pal, { band: partner.pal.paddle }, LOOKS[(partner.look + 2) % LOOKS.length]);
      A.push(actor(1, false, -5, 15, opp, oppPal, [-99, 0]));
      A.push(actor(1, false, 5, 15, partner, pal2, [0, 99]));
    } else A.push(actor(1, false, 0, 15, opp, oppPal, [-99, 99]));
    this.actors = A;
    this.ball = null;
    this.score = [0, 0];
  };

  Duel.prototype._startMatch = function () {
    this.panelEl.classList.remove("kr-duel-panel--on");
    this._clearScreenTimers();
    this.keys = {}; this.joy = null; this.swipe = null;
    this._lastFault = "";
    this._shotAttempt = null; this._shotFeedback = "";
    this._coachSuccessUntil = 0;
    this._lastResult = null;
    this._lastDailyIdx = null;
    this.capsule = null; this.capSpawnIn = null; this._rage = false; this._lastBoss = false; this._lastEarn = 0; this._coachKey = "";
    this._m = null;
    if (!this.drill) {
      this._m = { t0: Date.now(), maxRally: 0, caps: 0, powers: 0, pts: [] };
      this._visitMatches = (this._visitMatches || 0) + 1;
      this._track(this.daily ? "daily-start" : "duel-start");
      if (this._visitMatches === 2) this._track("duel-second");
    }
    this.charge = this._player().startCharge || 0;
    this.power = null;
    RNG = this.daily ? seeded(this.daily.seed) : Math.random;
    this._setupActors();
    this._guidedReturn = !this.drill && !this.daily && !this.save.coached;
    this.serverTeam = this.drill || this._guidedReturn ? 1 : 0;
    this.serveTurn = [0, 0];
    this._updateScore();
    this._beginServe();
    if (!this.drill && this._opp().boss) { this._banner((this.t.bossIntro || "FINAL BOSS: {name}").replace("{name}", this._opp().name), 2200, "bad"); this.shakeUntil = this.now + 0.3; }
  };

  Duel.prototype._teamActors = function (team) { return this.actors.filter(function (a) { return a.team === team; }); };

  Duel.prototype._beginServe = function () {
    this.phase = "serve";
    this.phaseAt = this.now;
    this.actors.forEach(function (a) { a.x = a.homeX; a.y = a.homeY; a.vx = a.vy = 0; a.swingUntil = 0; a.planId = -1; });
    var team = this._teamActors(this.serverTeam);
    var srv = team[this.serveTurn[this.serverTeam] % team.length];
    this.server = srv;
    srv.y = (srv.team === 0 ? -1 : 1) * (CL + 0.8);
    this.capsule = null;
    this.ball = { x: srv.x + 1.2, y: srv.y, z: 3.4, vx: 0, vy: 0, vz: 0, live: false, held: true, lastHitTeam: srv.team, bounces: 0, hits: 0, isServe: true, id: (this.ballId = (this.ballId || 0) + 1) };
    if (this.fx) this.fx.trailClear();
    if (this.drill) {
      this._banner((this.t.drillGoals || {})[this.drill.id] || "", 0);
      return;
    }
    this._banner(srv.human ? (this.t.yourServe || "Your serve — swing to serve") : "", 0);
  };

  Duel.prototype._updateScore = function () {
    if (this.drill) {
      this.scoreEl.textContent = (this.t.drillScore || "{hits} targets · {attempts}/{total} balls")
        .replace("{hits}", this.drill.hits).replace("{attempts}", this.drill.attempts).replace("{total}", DRILL_BALLS);
      return;
    }
    var opp = this._opp();
    this.scoreEl.innerHTML = '<span class="kr-duel-you">' + esc(this.t.you || "YOU") + '</span><b>' + this.score[0] + '</b><i>–</i><b>' + this.score[1] + '</b><span class="kr-duel-them">' + esc(opp.name) + '</span>';
  };

  Duel.prototype._banner = function (text, ms, kind) {
    this.bannerEl.textContent = text || "";
    this.bannerEl.className = "kr-duel-banner" + (text ? " kr-duel-banner--on" : "") + (kind ? " kr-duel-banner--" + kind : "");
    this.bannerUntil = ms ? this.now + ms / 1000 : 0;
  };

  // ───────────────────────── Input ─────────────────────────
  Duel.prototype._key = function (e, down) {
    if (!this.root) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var map = { ArrowLeft: "l", a: "l", ArrowRight: "r", d: "r", ArrowUp: "u", w: "u", ArrowDown: "d", s: "d" };
    if (k === "Escape" && down) { this.destroy(); return; }
    if (k === "m" && down && !e.repeat) { this._toggleSound(); return; }
    if (this.phase === "menu") return;
    if (k === "e" && down && !e.repeat) { this._activatePower(); return; }
    if (map[k]) { this.keys[map[k]] = down; e.preventDefault(); }
    if (k === " " && down && !e.repeat) { e.preventDefault(); this._swing((this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0), (this.keys.u ? 1 : 0) - (this.keys.d ? 1 : 0)); }
    if (k === " ") e.preventDefault();
  };

  Duel.prototype._pos = function (e) { var r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  Duel.prototype._pDown = function (e) {
    if (this.phase === "menu") return;
    e.preventDefault();
    var p = this._pos(e);
    if (e.pointerType === "mouse") {
      // Click where you want the ball: map the cursor onto the far half.
      this._swing(clamp((p.x - this.W / 2) / (this.W * 0.3), -1, 1), clamp((this.netScreenY - p.y) / Math.max(40, this.netScreenY - this.farScreenY) * 2 - 1, -1, 1));
      return;
    }
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { }
    if (p.x < this.W / 2) {
      if (!this.joy) this.joy = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
    } else if (!this.swipe) {
      this.swipe = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
    }
  };
  Duel.prototype._pMove = function (e) {
    var p = this._pos(e);
    if (this.joy && this.joy.id === e.pointerId) { this.joy.x = p.x; this.joy.y = p.y; }
    if (this.swipe && this.swipe.id === e.pointerId) { this.swipe.x = p.x; this.swipe.y = p.y; }
  };
  Duel.prototype._pUp = function (e, cancelled) {
    if (this.joy && this.joy.id === e.pointerId) this.joy = null;
    if (this.swipe && this.swipe.id === e.pointerId) {
      if (!cancelled) {
        var p = this._pos(e);
        this.swipe.x = p.x; this.swipe.y = p.y;
        var a = this._swipeAim();
        this._swing(a.x, a.y);
      }
      this.swipe = null;
    }
  };
  Duel.prototype._swipeAim = function () {
    var s = this.swipe; if (!s) return { x: 0, y: 0 };
    var distance = clamp(this.W * 0.14, 42, 70);
    var dx = s.x - s.ox, dy = s.oy - s.y;
    if (Math.hypot(dx, dy) < 6) return { x: 0, y: 0 };
    return { x: clamp(dx / distance, -1, 1), y: clamp(dy / distance, -1, 1) };
  };
  Duel.prototype._liveAim = function () {
    if (this.swipe) return this._swipeAim();
    return { x: (this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0), y: (this.keys.u ? 1 : 0) - (this.keys.d ? 1 : 0) };
  };

  Duel.prototype._swing = function (ax, ay) {
    var h = this.human;
    if (this.phase !== "serve" && this.phase !== "rally") return;
    h.aimX = ax; h.aimY = ay;
    h.swingUntil = this.now + 0.26;
    h.swingAnim = this.now + 0.3;
    h.swung = false;
    this._shotFeedback = "";
    this._shotAttempt = this.phase === "rally" && this.ball && this.ball.live && !this.ball.dead ? this.ball.id : null;
  };

  // ───────────────────────── Shots ─────────────────────────
  // aimY: -1 dink into the kitchen, 0 safe middle, +1 deep drive.
  function aimToShot(ax, ay, dir) {
    var depth = ay < 0 ? lerp(13, 3.8, -ay) : lerp(13, 19.3, ay);
    var speed = ay < 0 ? lerp(33, 19, -ay) : lerp(33, 46, ay);
    return { tx: ax * 8.3, ty: dir * depth, speed: speed };
  }

  Duel.prototype._launch = function (a, shot, sigma, badness) {
    var b = this.ball, dir = a.team === 0 ? 1 : -1;
    var pw = a.human && this._pw("power"), pp = a.human && this._player().smash;
    var smash = !shot.loft && b.z > (pw ? 4.2 : pp ? 4.8 : 5.4) && Math.abs(shot.ty) > 8 && !b.held;
    var speed = (smash ? 58 : shot.speed) * (pw ? 1.15 : pp ? 1.06 : 1);
    if (a.human && this._pw("precision")) sigma *= 0.45;
    // (Rally ramp is applied as the ball clock rate `b.rate`, set below: speeding up the shot itself cannot work
    // because the arc must still clear the net.)
    var tx = shot.tx + gauss() * sigma, ty = shot.ty + gauss() * sigma * 1.3;
    var dx = tx - b.x, dy = ty - b.y;
    var D = Math.max(1, Math.hypot(dx, dy));
    var T = D / speed;
    if (shot.loft) T = Math.max(T, 1.75);
    // Raise the arc until it clears the net. A stretched or rushed shot gets less margin, so it can clip the tape.
    var need = NET_H + 0.9 - badness * rand() * 1.7;
    // Only meaningful when the shot actually crosses the net. A ball struck just past the net toward
    // the far side never "clears" it, which used to inflate T without bound (z ~ 1000, point never ends).
    if (b.y * ty < 0 && Math.abs(dy) > 0.01) {
      for (var i = 0; i < 40 && T < 3.2; i++) {
        var vz = (0.5 * G * T * T - b.z) / T;
        var tn = (0 - b.y) / (dy / T);
        var zn = b.z + vz * tn - 0.5 * G * tn * tn;
        if (zn >= need) break;
        T *= 1.05;
      }
    }
    b.vx = dx / T; b.vy = dy / T; b.vz = (0.5 * G * T * T - b.z) / T;
    b.live = true; b.held = false; b.lastHitTeam = a.team; b.bounces = 0; b.hits += 1; b.id = ++this.ballId;
    b.rate = 1 + clamp(Math.max(0, b.hits - 1) * 0.035, 0, 0.3);
    if (this._m) this._m.maxRally = Math.max(this._m.maxRally, b.hits);
    if (a.human && b.hits > 1 && !this.drill && !this.daily && !this.save.coached) {
      this._guidedReturn = false;
      this._coachSuccessUntil = this.now + 1.25;
      this.save.coached = true;
      writeSave(this.save);
      this._track("tutorial-complete");
    }
    b.isServe = b.hits === 1;
    a.swingAnim = this.now + 0.3; a.swung = true;
    a.side = b.x >= a.x ? 1 : -1;
    this.phase = "rally";
    if (a.human && this.bannerEl.textContent) this._banner("", 0);
    this._sound("smash");
    if (a.human && smash) this._buzz("smash");
    var p = this._project(b.x, b.y, b.z);
    if (this.fx) {
      this.fx.burst(p.x, p.y, smash ? ["#ffd60a", "#ffffff", "#ff8a3d"] : ["#ffffff", "#e8ff3a"], smash ? 20 : 8, { speed: smash ? 380 : 200, up: 40 });
      this.fx.ring(p.x, p.y, smash ? "#ffd60a" : "#ffffff", smash ? 70 : 34);
      if (smash) this.fx.punch(0.025, this.now * 1000);
    }
    if (smash) this.freezeUntil = this.now + 0.06;
    void dir;
  };

  Duel.prototype._hitReach = function (a) {
    return a.human ? 4.7 * this._pstat("reach") * (this._pw("reach") ? 1.35 : 1) : 3.4;
  };

  Duel.prototype._tryHit = function (a, shot, sigma) {
    var b = this.ball;
    // A dead ball (point already awarded, e.g. into the net) must never be hit: that restarted the rally phase and froze the match.
    if (!b || !b.live || b.dead || b.lastHitTeam === a.team) return false;
    if (a.team === 0 ? b.y > 0.6 : b.y < -0.6) return false;
    var reach = this._hitReach(a);
    var d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d > reach || b.z > 8.6) return false;
    var volley = b.bounces === 0;
    if (volley && b.hits < 3) { this._point(1 - a.team, "twoBounce"); return true; }
    if (volley && Math.abs(a.y) < KIT && !(a.human && this._pw("pass"))) { this._point(1 - a.team, "kitchen"); return true; }
    var badness = clamp((d - 1.4) / (reach - 1.4), 0, 1);
    this._launch(a, shot, sigma + badness * 2.6, badness);
    return true;
  };

  // Forward-simulate the ball: first bounce, and where it is shortly after.
  Duel.prototype._predict = function () {
    var b = this.ball, s = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz }, dt = 1 / 60, bounce = null, after = null;
    for (var t = 0; t < 4; t += dt) {
      s.vz -= G * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      if (s.z <= 0 && s.vz < 0) {
        if (bounce) break;
        bounce = { x: s.x, y: s.y, t: t };
        s.z = 0; s.vz *= -0.62; s.vx *= 0.72; s.vy *= 0.72;
      }
      if (bounce && !after && t >= bounce.t + 0.34) after = { x: s.x, y: s.y };
    }
    return { bounce: bounce, after: after || bounce };
  };

  Duel.prototype._aiShot = function (a) {
    var k = a.skill, dir = a.team === 0 ? 1 : -1, foes = this._teamActors(1 - a.team);
    var atNet = foes.some(function (f) { return Math.abs(f.y) < KIT + 2; });
    if (atNet && rand() < k.lobP) return { tx: (rand() - 0.5) * 12, ty: dir * 18, speed: 30, loft: true };
    var best = null, bestS = -1;
    var xs = [-7.6, -4, 0, 4, 7.6], ds = [3.8, 13, 18.6];
    for (var i = 0; i < xs.length; i++) for (var j = 0; j < ds.length; j++) {
      var tx = xs[i], ty = dir * ds[j];
      var open = Math.min.apply(null, foes.map(function (f) { return Math.hypot(f.x - tx, (f.y - ty) * 0.8); }));
      var s = open * k.aggr + rand() * 9 * (1 - k.aggr) + (j === 0 ? k.dinkP * 6 - 3 : 0) + (j === 1 ? 1.5 * (1 - k.aggr) : 0);
      var tr = k.trait;
      if (tr === "centre") s += (6 - Math.abs(tx)) * 0.5;
      else if (tr === "sides") s += Math.abs(tx) * 0.45;
      else if (tr === "left") s += (tx < 0 ? 2.5 : 0);
      else if (tr === "right") s += (tx > 0 ? 2.5 : 0);
      if (s > bestS) { bestS = s; best = { tx: tx, ty: ty, speed: (j === 0 ? 20 : j === 1 ? 32 : 43) * k.pace * ((k.boss && this._rage) ? 1.1 : 1) }; }
    }
    if (k.trait === "tempo") { this._tempo = !this._tempo; best.speed *= this._tempo ? 1.25 : 0.78; }
    return best;
  };

  Duel.prototype._ai = function (a, dt) {
    var b = this.ball, k = a.skill, dir = a.team === 0 ? -1 : 1;   // dir: which way is "back" for this actor
    var incoming = b && b.live && !b.dead && b.lastHitTeam !== a.team;
    if (incoming && a.planId !== b.id) {
      a.planId = b.id;
      var pr = this._predict(), bo = pr.bounce;
      a.mine = false; a.leave = false;
      if (bo) {
        var mineSide = a.team === 0 ? bo.y < 0 : bo.y > 0;
        var outBy = Math.max(Math.abs(bo.x) - CW, Math.abs(bo.y) - CL);
        a.mine = mineSide && bo.x >= a.zone[0] && bo.x < a.zone[1];
        a.leave = !mineSide || outBy > k.judge * (0.4 + rand() * 0.8);
        a.goalX = pr.after.x;
        a.goalY = clamp(pr.after.y + dir * 1.2, a.team === 0 ? -CL - 5 : 1, a.team === 0 ? -1 : CL + 5);
        a.reactAt = this.now + k.react * (0.8 + rand() * 0.5);
      }
    }
    var gx = a.homeX, gy = a.homeY;
    if (incoming && a.mine && !a.leave) { if (this.now >= a.reactAt) { gx = a.goalX; gy = a.goalY; } else { gx = a.x; gy = a.y; } }
    else if (b && b.live) gx = a.homeX + clamp(b.x - a.homeX, -3, 3) * 0.35;
    var dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy), step = k.speed * ((k.boss && this._rage) ? 1.18 : 1) * dt;
    if (d > 0.15) { var m = Math.min(1, step / d); a.vx = dx * m / dt; a.vy = dy * m / dt; a.x += dx * m; a.y += dy * m; }
    else { a.vx = a.vy = 0; }
    if (incoming && a.mine && !a.leave) {
      var canVolley = k.volley && b.hits >= 3 && Math.abs(a.y) > KIT + 0.3 && b.z > 2.4 && b.z < 7;
      if (b.bounces >= 1 || canVolley) this._tryHit(a, this._aiShot(a), k.err);
    }
  };

  // ───────────────────────── Rules ─────────────────────────
  Duel.prototype._point = function (team, reason) {
    if (this.phase === "point" || this.phase === "menu") return;
    if (this.drill) { this._drillAttempt(false); return; }
    var b = this.ball; if (b) b.live = false;
    this.phase = "point";
    this._guidedReturn = false;
    this._coachSuccessUntil = 0;
    this.phaseAt = this.now;
    this.score[team] += 1;
    if (this._m && this._m.pts.length < 40) this._m.pts.push(team + ":" + reason);
    if (team === 0 && !this.daily && !this._pw("any")) this.charge = Math.min(this._chargeMax(), (this.charge || 0) + 1);
    this.serveTurn[team] += (this.serverTeam === team) ? 0 : 1;
    this.serverTeam = team;
    this._updateScore();
    var t = this.t, mine = team === 0;
    if (!mine) this._lastFault = reason;
    var why = { out: t.out || "Out!", net: t.net || "Net!", twoBounce: t.twoBounce || "It had to bounce!", kitchen: t.kitchen || "Kitchen fault!", serveShort: t.serveShort || "Serve too short!", winner: "" }[reason] || "";
    this._banner((why ? why + " " : "") + (mine ? (t.yourPoint || "Your point") : (t.theirPoint || "Their point")), 1300, mine ? "good" : "bad");
    if (!mine && this._opp().boss && !this._rage && this.score[1] >= 3) { this._rage = true; this.shakeUntil = this.now + 0.4; this._banner(t.bossRage || "RAGE!", 1500, "bad"); }
    this._sound(mine ? "milestone" : "fault");
    if (!mine) this._buzz("fault");
    if (mine && this.fx && b) { var p = this._project(b.x, b.y, b.z); this.fx.burst(p.x, p.y, ["#ffd60a", "#ffffff", "#3fd0ff"], 16, { speed: 300, up: 120, rect: true }); }
    if (!mine) this.shakeUntil = this.now + 0.2;
  };

  Duel.prototype._afterPoint = function () {
    if (this.drill) {
      if (this.drill.attempts >= DRILL_BALLS) this._finishDrill();
      else this._beginServe();
      return;
    }
    var s = this.score, lead = Math.abs(s[0] - s[1]);
    if ((s[0] >= WIN_SCORE || s[1] >= WIN_SCORE) && lead >= 1) {
      var won = s[0] > s[1], sv = this.save, idx = this._oppIdx(), isDaily = !!this.daily;
      this._lastScore = [s[0], s[1]];
      this._logMatch(won, s, isDaily);
      this._track(isDaily ? "daily-complete" : "duel-complete");
      if (!isDaily && won && !sv.coached) sv.coached = true;
      this._lastBoss = won && !isDaily && !!this._opp().boss;
      // Coins: soft currency earned by playing (the Daily pays once a day, on the first attempt).
      var firstDaily = isDaily && (!sv.daily || sv.daily.key !== this.daily.key);
      var earn = isDaily ? (firstDaily ? (won ? 25 : 10) : 0) : ((won ? 20 + 6 * idx + 10 * (this._world() - 1) + (this._lastBoss ? 60 : 0) : 6) + s[0]);
      sv.coins = clamp((Number(sv.coins) || 0) + earn, 0, 999999); this._lastEarn = earn;
      if (isDaily) {
        // Daily Duel never touches the ladder; only the first attempt of the day is recorded.
        this._lastDailyIdx = this.daily.idx;
        if (!sv.daily || sv.daily.key !== this.daily.key) sv.daily = { key: this.daily.key, you: s[0], them: s[1], idx: this.daily.idx };
        this.daily = null; RNG = Math.random;
      } else {
        sv.history = (sv.history || []).concat([{ d: Date.now(), stage: this.stage, mode: this.mode, you: s[0], them: s[1] }]).slice(-HISTORY_MAX);
        if (won) { sv.beaten = sv.beaten || {}; sv.beaten[idx] = true; sv.bestMargin = Math.max(Number(sv.bestMargin) || 0, s[0] - s[1]); }
        if (won) { this.stage += 1; this.save.stage = this.stage; this.save.wins = (Number(this.save.wins) || 0) + 1; }
      }
      if (won) { if (this.fx) { this.fx.confetti(this.W, this.H); if (this._lastBoss) this.fx.confetti(this.W, this.H); } this._sound("newBest"); }
      else this._sound("gameOver");
      writeSave(this.save);
      this._lastResult = won ? "win" : "lose";
      this._banner("", 0);
      var self = this;
      this._splashT = setTimeout(function () {
        self._splashT = 0;
        if (self.root && self.phase === "menu") self._showSplash(self._lastResult);
      }, won ? 600 : 250);
      this.phase = "menu";
      return;
    }
    this._beginServe();
  };

  Duel.prototype._stepBall = function (dt) {
    var b = this.ball; if (!b || !b.live) return;
    dt *= (b.rate || 1);
    var py = b.y;
    b.vz -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if ((py < 0) !== (b.y < 0) && Math.abs(b.x) < CW + 1.5 && b.z < NET_H + BALL_R) {
      b.y = py; b.vy *= -0.12; b.vx *= 0.3; b.vz = Math.min(b.vz, 0);
      this._sound("bounce");
      this._point(1 - b.lastHitTeam, "net");
      b.live = true; b.dead = true;   // let it drop for the visual, rules are settled
      return;
    }
    if (b.z <= 0 && b.vz < 0) {
      b.z = 0; b.vz *= -0.62; b.vx *= 0.72; b.vy *= 0.72; b.bounces += 1;
      if (b.dead) { if (b.bounces > 3) b.live = false; return; }
      this._sound("bounce");
      var p = this._project(b.x, b.y, 0);
      if (this.fx) this.fx.ring(p.x, p.y, "rgba(255,255,255,0.9)", (b.bounces === 1 ? 3.2 : 2.2) * p.s, 260);
      var side = b.y < 0 ? 0 : 1, inCourt = Math.abs(b.x) <= CW + 0.15 && Math.abs(b.y) <= CL + 0.15;
      if (b.bounces === 1) {
        if (this.drill && b.lastHitTeam === 0) {
          var target = this._drillTarget();
          this._drillAttempt(side === 1 && inCourt && b.x >= target.left && b.x <= target.right &&
            b.y >= target.near && b.y <= target.far);
          return;
        }
        if (side === b.lastHitTeam) this._point(1 - b.lastHitTeam, "net");
        else if (!inCourt) this._point(1 - b.lastHitTeam, "out");
        else if (b.isServe && Math.abs(b.y) < KIT) this._point(1 - b.lastHitTeam, "serveShort");
        if (this.phase === "point") { b.live = true; b.dead = true; }
      } else if (b.bounces === 2) { this._point(b.lastHitTeam, "winner"); b.live = true; b.dead = true; }
    }
    if (Math.abs(b.y) > 60 || Math.abs(b.x) > 45) b.live = false;
  };

  Duel.prototype._update = function (dt) {
    var self = this, h = this.human, b = this.ball;
    if (this.bannerUntil && this.now > this.bannerUntil) this._banner("", 0);
    if (this.phase === "menu") return;

    // Human movement
    var mx = (this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0), my = (this.keys.u ? 1 : 0) - (this.keys.d ? 1 : 0);
    if (this.joy) { mx = clamp((this.joy.x - this.joy.ox) / 46, -1, 1); my = clamp((this.joy.oy - this.joy.y) / 46, -1, 1); }
    var ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    if (this.phase === "serve" && this.server === h) { mx = 0; my = 0; }
    var spd = (this._pw("sprint") ? 23 : 18) * this._pstat("speed");
    h.vx = mx * spd; h.vy = my * spd;
    h.x = clamp(h.x + h.vx * dt, -CW - 2, CW + 2);
    h.y = clamp(h.y + h.vy * dt, -CL - 3, -0.9);

    if (this.phase === "serve") {
      var srv = this.server; b.x = srv.x + 1.2 * (srv.team === 0 ? 1 : -1); b.y = srv.y; b.z = 3.4;
      var dir = srv.team === 0 ? 1 : -1;
      if (srv.human) {
        if (this.now < h.swingUntil && !h.swung) { var sh = aimToShot(h.aimX, Math.max(-0.1, h.aimY), dir); sh.ty = dir * Math.max(10.5, Math.abs(sh.ty)); this._launch(h, sh, 0.7, 0.1); }
      } else if (this.now - this.phaseAt > 1.1) {
        if (this.drill) {
          var cfg = DRILLS[this.drill.id];
          this._launch(srv, { tx: h.homeX, ty: cfg.feed, speed: 26, loft: true }, 0, 0);
        } else if (this._guidedReturn) this._launch(srv, { tx: h.homeX, ty: -14, speed: 26, loft: true }, 0, 0);
        else this._launch(srv, { tx: (rand() - 0.5) * 13, ty: dir * (12 + rand() * 6), speed: 34 * srv.skill.pace }, srv.skill.err * 0.6, 0.1);
      }
      this.actors.forEach(function (a) { if (!a.human && a !== srv) self._ai(a, dt); });
      return;
    }

    if (this.phase === "rally" && this.now < h.swingUntil && !h.swung) {
      if (this._tryHit(h, aimToShot(h.aimX, h.aimY, 1), 0.55)) h.swung = true;
    }
    if (this._shotAttempt != null && (h.swung || this.now >= h.swingUntil)) {
      if (this.phase === "rally" && b.id === this._shotAttempt && !h.swung) {
        this._shotFeedback = b.lastHitTeam !== 1 || b.y > 0.6 ? "shotEarly" : "shotReach";
        this._shotFeedbackUntil = this.now + 1;
      }
      this._shotAttempt = null;
    }
    if (!this.drill && (this.phase === "rally" || this.phase === "point")) this.actors.forEach(function (a) { if (!a.human) self._ai(a, dt); });
    this._capsules(dt);
    var steps = 4; for (var i = 0; i < steps; i++) this._stepBall(dt / steps);
    // Watchdog: a rally whose ball is no longer live must end, otherwise the match would hang.
    if (this.phase === "rally" && this.ball && !this.ball.live) this._point(1 - this.ball.lastHitTeam, "out");
    if (this.phase === "point" && this.now - this.phaseAt > 1.35) this._afterPoint();
  };

  // ───────────────────────── Camera ─────────────────────────
  Duel.prototype._resize = function () {
    var W = this.root.clientWidth, H = this.root.clientHeight, dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    this.W = W; this.H = H; this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr);
    var portrait = H / W > 1.25, pitch = (portrait ? 59 : 34) * Math.PI / 180, dist = portrait ? 78 : 70;
    this.cam = { sin: Math.sin(pitch), cos: Math.cos(pitch), y: -Math.cos(pitch) * dist, z: Math.sin(pitch) * dist };
    this.fit = { s: 1, ox: 0, oy: 0 };
    var pts = [[-CW - 1.3, -CL - 3.5, 0], [CW + 1.3, -CL - 3.5, 0], [-CW - 1.3, CL + 2, 0], [CW + 1.3, CL + 2, 0], [0, CL, 8]];
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (var i = 0; i < pts.length; i++) { var p = this._project(pts[i][0], pts[i][1], pts[i][2]); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    var top = 64, bottom = portrait ? 24 : 12;
    var s = Math.min(W / (x1 - x0), (H - top - bottom) / (y1 - y0));
    this.fit = { s: s, ox: W / 2 - (x0 + x1) / 2 * s, oy: top + ((H - top - bottom) - (y1 - y0) * s) / 2 - y0 * s };
    this.netScreenY = this._project(0, 0, 0).y;
    this.farScreenY = this._project(0, CL, 0).y;
    this._bg = null;
  };

  Duel.prototype._project = function (x, y, z) {
    var c = this.cam, dy = y - c.y, dz = z - c.z;
    var depth = dy * c.cos - dz * c.sin;
    var up = dy * c.sin + dz * c.cos;
    var f = 1 / Math.max(1, depth), k = this.fit;
    return { x: x * f * k.s + k.ox, y: -up * f * k.s + k.oy, s: f * k.s };
  };

  // ───────────────────────── Rendering ─────────────────────────
  Duel.prototype._quad = function (g, x0, y0, x1, y1, fill) {
    var a = this._project(x0, y0, 0), b = this._project(x1, y0, 0), c = this._project(x1, y1, 0), d = this._project(x0, y1, 0);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath();
    g.fillStyle = fill; g.fill();
  };
  Duel.prototype._line = function (g, x0, y0, x1, y1, w) {
    var a = this._project(x0, y0, 0), b = this._project(x1, y1, 0);
    g.lineWidth = Math.max(1.5, w * (a.s + b.s) / 2); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  };

  Duel.prototype._venueHtml = function () {
    var t = this.t, sv = this.save, self = this, names = t.venues || {}, cur = this._venueId();
    var sel = (sv.venue && (sv.venue === "auto" || hasVenue(sv.venue))) ? sv.venue : "auto";
    function chip(id, label, locked, title, on, sw) {
      return '<button class="kr-duel-chip' + (on ? " kr-duel-chip--eq" : "") + '" data-duel="venue-' + id + '" aria-pressed="' + (on ? "true" : "false") + '"' + (locked ? ' aria-disabled="true"' : "") + (title ? ' title="' + esc(title) + '"' : "") + ">" + (sw || "") + esc(label) + "</button>";
    }
    var chips = chip("auto", t.venueAuto || "Auto", false, "", sel === "auto", "");
    VENUE_ORDER.forEach(function (id) {
      var V = VENUES[id], locked = self.stage < V.unlock;
      chips += chip(id, names[id] || id, locked, locked ? (t.venueLocked || "Reach opponent {n} to unlock").replace("{n}", V.unlock + 1) : "", sel === id,
        '<i class="kr-duel-swatch" style="background:linear-gradient(135deg,' + V.sky[0] + "," + V.court + ')"></i>');
    });
    return '<div class="kr-duel-venues" role="group" aria-label="' + esc(t.venueLabel || "Court") + '">' + chips + "</div>" +
      '<p class="kr-muted kr-duel-venuenow">' + esc(this.venueMsg || (t.venueNow || "Playing at: {name}").replace("{name}", names[cur] || cur)) + "</p>";
  };

  // Scenery behind the stands (mostly visible in landscape and on tall screens).
  Duel.prototype._scene = function (g, V, W, H, horizon, rnd) {
    var i, k;
    if (V.scene === "skyline") {
      var bx = 0;
      while (bx < W) {
        var bw = 14 + rnd() * 30, bh = 18 + rnd() * horizon * 0.5;
        g.fillStyle = "#1a1038"; g.fillRect(bx, horizon - bh, bw, bh + 6);
        g.fillStyle = "rgba(255,210,120,0.85)";
        for (var wy = horizon - bh + 4; wy < horizon - 6; wy += 7) for (var wx = bx + 3; wx < bx + bw - 3; wx += 6) if (rnd() < 0.35) g.fillRect(wx, wy, 2.5, 3.5);
        bx += bw + 2;
      }
    } else if (V.scene === "sea") {
      g.fillStyle = "#1c8fc7"; g.fillRect(0, horizon * 0.7, W, horizon * 0.3 + 4);
      g.fillStyle = "rgba(255,230,170,0.6)";
      for (k = 0; k < 10; k++) { var sw = 70 - k * 5; g.fillRect(W / 2 - sw / 2, horizon * 0.72 + k * horizon * 0.028, sw, 2.5); }
    } else if (V.scene === "lights") {
      [[0.1, "180,210,255"], [0.9, "255,190,150"]].forEach(function (L) {
        var lx = W * L[0], cone = g.createRadialGradient(lx, 0, 0, lx, 0, H * 0.7);
        cone.addColorStop(0, "rgba(" + L[1] + ",0.5)"); cone.addColorStop(1, "rgba(" + L[1] + ",0)");
        g.fillStyle = cone; g.fillRect(0, 0, W, H);
      });
    } else if (V.scene === "beams") {
      for (i = 0; i < 4; i++) {
        var x0 = W * (0.15 + 0.23 * i), dx = i % 2 ? 50 : -50;
        g.fillStyle = "rgba(255,214,90,0.12)"; g.beginPath(); g.moveTo(x0 - 6, 0); g.lineTo(x0 + 6, 0); g.lineTo(x0 + dx + 60, horizon + 60); g.lineTo(x0 + dx - 60, horizon + 60); g.closePath(); g.fill();
      }
    } else if (V.scene === "gym") {
      g.strokeStyle = "rgba(255,255,255,0.06)"; g.lineWidth = 1;
      for (k = 6; k < horizon + 40; k += 14) { g.beginPath(); g.moveTo(0, k); g.lineTo(W, k); g.stroke(); }
      for (i = 0; i < 4; i++) {
        var lx = W * (0.1 + 0.22 * i), lg = g.createLinearGradient(0, 0, 0, horizon * 0.9);
        lg.addColorStop(0, "rgba(255,244,200,0.55)"); lg.addColorStop(1, "rgba(255,244,200,0)");
        g.fillStyle = lg; g.fillRect(lx, 0, W * 0.16, horizon * 0.9); g.fillStyle = "rgba(255,248,220,0.95)"; g.fillRect(lx, 3, W * 0.16, 4);
      }
    }
  };

  Duel.prototype._drawBackground = function (previewId) {
    var id = previewId || this._venueId(), V = VENUES[id] || VENUES.park, W = this.W, H = this.H, dpr = this.dpr;
    var c = document.createElement("canvas"); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    var g = c.getContext("2d"); g.scale(dpr, dpr);
    var horizon = this._project(0, CL + 16, 0).y, i;
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    // Sky (or the wall, in the gym)
    var sky = g.createLinearGradient(0, 0, 0, Math.max(60, horizon));
    sky.addColorStop(0, V.sky[0]); sky.addColorStop(1, V.sky[1]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    if (V.glow) {
      var gx = W * V.glow[0], gy = horizon * V.glow[1], gl = g.createRadialGradient(gx, gy, 4, gx, gy, W * V.glow[3]);
      gl.addColorStop(0, "rgba(" + V.glow[2] + ",0.95)"); gl.addColorStop(0.12, "rgba(" + V.glow[2] + ",0.5)"); gl.addColorStop(1, "rgba(" + V.glow[2] + ",0)");
      g.fillStyle = gl; g.fillRect(0, 0, W, horizon + 10);
    }
    if (V.stars) { g.fillStyle = "#ffffff"; for (i = 0; i < 60; i++) { g.globalAlpha = 0.3 + rnd() * 0.7; g.fillRect(rnd() * W, rnd() * horizon * 0.9, 1.4, 1.4); } g.globalAlpha = 1; }
    if (V.clouds) {
      g.fillStyle = "rgba(255,255,255,0.85)";
      [[0.18, 0.3, 1], [0.55, 0.16, 0.7], [0.36, 0.55, 0.55]].forEach(function (cl) {
        var cx = W * cl[0], cy = horizon * cl[1], r = W * 0.055 * cl[2];
        g.beginPath(); g.ellipse(cx, cy, r * 1.9, r * 0.62, 0, 0, 7); g.ellipse(cx - r * 0.9, cy + r * 0.12, r, r * 0.5, 0, 0, 7); g.ellipse(cx + r * 0.8, cy - r * 0.3, r * 1.1, r * 0.7, 0, 0, 7); g.fill();
      });
    }
    this._scene(g, V, W, H, horizon, rnd);
    // Grandstand behind the far baseline
    var st0 = this._project(-CW - 14, CL + 9, 0), st1 = this._project(CW + 14, CL + 9, 0), sh = Math.max(46, 15 * st0.s);
    var sg = g.createLinearGradient(0, st0.y - sh, 0, st0.y);
    sg.addColorStop(0, V.stand[0]); sg.addColorStop(1, V.stand[1]);
    g.fillStyle = sg; g.beginPath(); g.roundRect ? g.roundRect(st0.x, st0.y - sh, st1.x - st0.x, sh, 10) : g.rect(st0.x, st0.y - sh, st1.x - st0.x, sh); g.fill();
    var cols = V.crowd, rows = 7, dot = Math.max(1.8, sh / 24);
    for (var r = 0; r < rows; r++) for (var x = st0.x + dot * 2; x < st1.x - dot * 2; x += dot * 2.7) {
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      g.beginPath(); g.arc(x + (r % 2) * dot * 1.3, st0.y - sh + dot * 2 + r * (sh - dot * 3) / rows + rnd() * 2, dot, 0, 7); g.fill();
    }
    // Ground (striped), wide enough to cover the screen edges
    for (i = 0; i < 14; i++) { var ya = -CL - 14 + i * 5; this._quad(g, -90, ya, 90, ya + 5, V.ground[i % 2]); }
    // Sponsor boards
    var bd0 = this._project(-CW - 9, CL + 7, 0), bd1 = this._project(CW + 9, CL + 7, 0), bh = Math.max(12, 2.6 * bd0.s);
    g.fillStyle = V.board[0]; g.fillRect(bd0.x, bd0.y - bh, bd1.x - bd0.x, bh);
    g.fillStyle = V.board[1]; g.font = "800 " + Math.round(bh * 0.62) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    var name = String(this.opts.appName || "KITCHEN RUSH").toUpperCase();
    for (var bi = -1; bi <= 1; bi++) g.fillText(name, W / 2 + bi * (bd1.x - bd0.x) / 3, bd0.y - bh / 2);
    // Court apron + playing surface
    this._quad(g, -CW - 3, -CL - 4.5, CW + 3, CL + 4.5, V.apron);
    this._quad(g, -CW, -CL, CW, CL, V.court);
    this._quad(g, -CW, -KIT, CW, 0, V.kitN);
    this._quad(g, -CW, 0, CW, KIT, V.kitF);
    // Soft light falloff toward the far end
    var a = this._project(0, -CL, 0), b = this._project(0, CL, 0);
    var sheen = g.createLinearGradient(0, b.y, 0, a.y);
    sheen.addColorStop(0, "rgba(10,20,60,0.22)"); sheen.addColorStop(0.5, "rgba(255,255,255,0)"); sheen.addColorStop(1, "rgba(255,255,255,0.10)");
    this._quad(g, -CW - 3, -CL - 4.5, CW + 3, CL + 4.5, sheen);
    // Lines
    g.strokeStyle = V.line; g.lineCap = "round";
    var L = 0.28;
    this._line(g, -CW, -CL, CW, -CL, L); this._line(g, -CW, CL, CW, CL, L);
    this._line(g, -CW, -CL, -CW, CL, L); this._line(g, CW, -CL, CW, CL, L);
    this._line(g, -CW, -KIT, CW, -KIT, L); this._line(g, -CW, KIT, CW, KIT, L);
    this._line(g, 0, -CL, 0, -KIT, L); this._line(g, 0, KIT, 0, CL, L);
    // Kitchen labels
    g.fillStyle = "rgba(255,255,255,0.33)";
    var kl = this._project(0, -KIT / 2, 0);
    g.font = "800 " + Math.round(2.1 * kl.s) + "px system-ui, sans-serif";
    g.fillText(String(this.t.kitchen2 || "KITCHEN"), kl.x, kl.y);
    if (previewId) return c;
    this._bgVenue = id;
    this._bg = c;
  };

  Duel.prototype._drawNet = function (g) {
    var xl = -CW - 1, xr = CW + 1, n = 14, i;
    // Shadow on the near side
    this._quad(g, xl, -1.5, xr, 0, "rgba(0,0,30,0.18)");
    var top = [], bot = [];
    for (i = 0; i <= n; i++) { var x = lerp(xl, xr, i / n), sag = 0.18 * (1 - Math.pow(2 * i / n - 1, 2)); top.push(this._project(x, 0, NET_H - sag)); bot.push(this._project(x, 0, 0.15)); }
    g.beginPath(); g.moveTo(top[0].x, top[0].y);
    for (i = 1; i <= n; i++) g.lineTo(top[i].x, top[i].y);
    for (i = n; i >= 0; i--) g.lineTo(bot[i].x, bot[i].y);
    g.closePath(); g.fillStyle = "rgba(12,22,58,0.42)"; g.fill();
    g.strokeStyle = "rgba(255,255,255,0.32)"; g.lineWidth = 1;
    g.beginPath();
    for (i = 0; i <= n; i++) { g.moveTo(top[i].x, top[i].y); g.lineTo(bot[i].x, bot[i].y); }
    for (var r = 1; r < 4; r++) { g.moveTo(lerp(top[0].x, bot[0].x, r / 4), lerp(top[0].y, bot[0].y, r / 4)); for (i = 1; i <= n; i++) g.lineTo(lerp(top[i].x, bot[i].x, r / 4), lerp(top[i].y, bot[i].y, r / 4)); }
    g.stroke();
    g.strokeStyle = "#ffffff"; g.lineWidth = Math.max(3, 0.34 * top[0].s); g.lineJoin = "round";
    g.beginPath(); g.moveTo(top[0].x, top[0].y); for (i = 1; i <= n; i++) g.lineTo(top[i].x, top[i].y); g.stroke();
    // Posts
    [xl, xr].forEach(function (px) {
      var a = this._project(px, 0, 0), b = this._project(px, 0, NET_H + 0.3);
      g.strokeStyle = "#0e1b3d"; g.lineWidth = Math.max(4, 0.5 * a.s); g.lineCap = "round";
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.strokeStyle = "#ffd60a"; g.lineWidth = Math.max(2, 0.22 * a.s);
      g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x, b.y + 0.01); g.stroke();
    }, this);
  };

  Duel.prototype._drawActor = function (g, a) {
    var p = this._project(a.x, a.y, 0), sc = p.s * (this.H / this.W > 1.25 ? 0.142 : 0.112) * (a.skill && a.skill.boss ? 1.3 : 1), sp = Math.hypot(a.vx, a.vy), b = this.ball;
    var state = this.now < a.swingAnim ? "swingForehand" : (sp > 1.5 ? (Math.abs(a.vx) > Math.abs(a.vy) ? (a.vx < 0 ? "runLeft" : "runRight") : "running") : "idle");
    if (this.now >= a.swingAnim && b) a.side = b.x >= a.x ? 1 : -1;
    if (a.skill && a.skill.boss) {
      var rg = !!this._rage, pu = Math.sin(this.now * (rg ? 12 : 4));
      this._ring(g, a.x, a.y, 3.2 + pu * 0.18, 0, Math.PI * 2, true);
      g.save(); g.fillStyle = "rgba(255,59,59," + (rg ? 0.3 : 0.18) + ")"; g.fill(); g.strokeStyle = "rgba(255,90,90,0.95)"; g.lineWidth = 3; g.stroke(); g.restore();
      if (rg && this.fx && !this.fx.reduced && Math.random() < 0.5) { var bp = this._project(a.x, a.y, 4); this.fx.burst(bp.x + (Math.random() - 0.5) * 20, bp.y, ["#ff3b3b", "#ffd60a"], 1, { speed: 50, up: 120, life: 520, gravity: -60, size: 2.6 }); }
    }
    if (window.KR_CHARACTERS) {
      window.KR_CHARACTERS.draw(g, { x: p.x, y: p.y - 22 * sc, scale: sc, now: this.now * 1000, swingT: 1 - (a.swingAnim - this.now) / 0.3,
        state: state, side: a.side, facing: a.team === 0 ? "back" : "front", role: a.team === 0 ? "player" : "opponent", palette: a.pal,
        lookX: b ? clamp((b.x - a.x) / 8, -1, 1) : 0 });
    } else { g.fillStyle = a.pal.jerseyB; g.beginPath(); g.arc(p.x, p.y - 30 * sc, 14 * sc, 0, 7); g.fill(); }
    if (a.human) {
      var bob = Math.sin(this.now * 5) * 2;
      g.fillStyle = "#ffd60a"; g.strokeStyle = "#0b1026"; g.lineWidth = 1.5;
      var ty = p.y - 64 * sc + bob;
      g.beginPath(); g.moveTo(p.x, ty + 9); g.lineTo(p.x - 7, ty); g.lineTo(p.x + 7, ty); g.closePath(); g.fill(); g.stroke();
    }
  };

  Duel.prototype._drawBall = function (g) {
    var b = this.ball; if (!b) return;
    var gp = this._project(b.x, b.y, 0), p = this._project(b.x, b.y, b.z + BALL_R), r = Math.max(4, 0.46 * p.s);
    g.fillStyle = "rgba(0,0,30," + clamp(0.42 - b.z * 0.02, 0.12, 0.42).toFixed(2) + ")";
    g.beginPath(); g.ellipse(gp.x, gp.y, r * 1.15, r * 0.48, 0, 0, 7); g.fill();
    var boosted = this._pw("any") && b.lastHitTeam === 0 && b.live && !b.dead, prgb = boosted ? POWER_RGB[this.power.key] : "";
    if (this.fx && b.live && !b.dead) { this.fx.trailPush(b.id, p.x, p.y, r, boosted ? "rgb(" + prgb + ")" : "#f4ff8a"); this.fx.drawTrail(g, 0); }
    if (boosted) {
      g.save(); g.globalCompositeOperation = "lighter";
      var gl = g.createRadialGradient(p.x, p.y, r * 0.4, p.x, p.y, r * 2.8);
      gl.addColorStop(0, "rgba(" + prgb + ",0.6)"); gl.addColorStop(1, "rgba(" + prgb + ",0)");
      g.fillStyle = gl; g.beginPath(); g.arc(p.x, p.y, r * 2.8, 0, 7); g.fill(); g.restore();
    }
    var gr = g.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
    gr.addColorStop(0, "#fdffb8"); gr.addColorStop(0.6, "#e6ff2e"); gr.addColorStop(1, "#a6c400");
    g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
    g.strokeStyle = "#0b1026"; g.lineWidth = 1.4; g.stroke();
    this._ballScreen = p;
  };

  Duel.prototype._drawAim = function (g) {
    var b = this.ball, h = this.human; if (!b) return;
    var serving = this.phase === "serve" && this.server === h;
    var incoming = this.phase === "rally" && b.live && !b.dead && b.lastHitTeam === 1;
    if (!serving && !incoming) return;
    if (this._guidedReturn && incoming && !b.bounces) {
      var bounce = this._project(h.homeX, -14, 0);
      g.save();
      g.translate(bounce.x, bounce.y);
      g.strokeStyle = "#ffffff";
      g.fillStyle = "rgba(255,214,10,0.28)";
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, 0, 2.1 * bounce.s, bounce.s, 0, 0, Math.PI * 2);
      g.fill(); g.stroke();
      g.restore();
      return;
    }
    var a = this._liveAim(), sh = aimToShot(a.x, serving ? Math.max(-0.1, a.y) : a.y, 1);
    if (serving) sh.ty = Math.max(10.5, sh.ty);
    var extension = incoming ? clamp((Math.hypot(b.x - h.x, b.y - h.y) - 1.4) / (this._hitReach(h) - 1.4), 0, 1) : 0;
    var p = this._project(sh.tx, sh.ty, 0), r = (1.7 + 1.8 * extension) * p.s, pulse = 1 + Math.sin(this.now * 8) * 0.08;
    g.save(); g.translate(p.x, p.y); g.scale(1, 0.55);
    g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 2.5; g.setLineDash([6, 5]);
    g.beginPath(); g.arc(0, 0, r * pulse, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = "rgba(255,214,10,0.9)"; g.beginPath(); g.arc(0, 0, r * 0.28, 0, 7); g.fill();
    if (this._pw("precision")) {
      g.strokeStyle = "rgba(255,214,10,0.95)"; g.lineWidth = 2; g.setLineDash([]);
      g.beginPath(); g.moveTo(-r * 1.6, 0); g.lineTo(r * 1.6, 0); g.moveTo(0, -r * 1.6); g.lineTo(0, r * 1.6); g.stroke();
    }
    g.restore();
  };

  // ───────────────────────── Capsules (Arkanoid-style pickups) ─────────────────────────
  // During a rally a capsule drops onto YOUR half; run over it to get that power for 7 s. Off in the Daily Duel.
  Duel.prototype._spawnCapsule = function () {
    var h = this.human, lo = Math.max(-8, h.zone[0] + 1), hi = Math.min(8, h.zone[1] - 1);
    if (lo >= hi) { lo = -8; hi = 8; }
    this.capsule = { x: lo + rand() * (hi - lo), y: -(9 + rand() * 8), kind: this._equippedKey() || POWERS[Math.floor(rand() * POWERS.length)], born: this.now, until: this.now + CAPSULE_LIFE * (this._player().lucky ? 1.3 : 1) };
  };

  Duel.prototype._capsules = function (dt) {
    if (this.drill || this.daily || this.phase !== "rally") return;
    var c = this.capsule, h = this.human, b = this.ball;
    if (!c) {
      if (this.capSpawnIn == null) this.capSpawnIn = this._capDelay(3 + rand() * 3);
      this.capSpawnIn -= dt;
      if (this.capSpawnIn <= 0 && b && b.hits >= 2) this._spawnCapsule();
      return;
    }
    if (this.now > c.until) { this.capsule = null; this.capSpawnIn = 6 + rand() * 5; return; }
    if (this.now - c.born > 0.9 && Math.hypot(h.x - c.x, h.y - c.y) < 2.1 * (this._player().lucky ? 1.25 : 1)) this._collectCapsule();
  };

  // A caught capsule gives +1 super charge (never a random power).
  Duel.prototype._collectCapsule = function () {
    var c = this.capsule; if (!c) return;
    if (this._m) this._m.caps++;
    this.charge = Math.min(this._chargeMax(), (this.charge || 0) + 1);
    this.capsule = null; this.capSpawnIn = 6 + rand() * 5;
    this.flashUntil = this.now + 0.2; this._flashKey = c.kind;
    this._sound("milestone");
    this._banner((this.t.capsuleGot || "+1 charge") + " " + this.charge + "/" + this._chargeMax(), 800, "good");
    var p = this._project(c.x, c.y, 1);
    if (this.fx) { this.fx.burst(p.x, p.y, ["rgb(" + POWER_RGB[c.kind] + ")", "#ffffff"], 14, { speed: 280, up: 70 }); this.fx.ring(p.x, p.y, "rgb(" + POWER_RGB[c.kind] + ")", 56); }
  };

  function capIcon(g, kind, r) {
    g.save(); g.strokeStyle = "#0b1026"; g.fillStyle = "#0b1026"; g.lineWidth = Math.max(1.6, r * 0.24); g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
    if (kind === "reach") { g.moveTo(-r, 0); g.lineTo(r, 0); g.moveTo(-r, 0); g.lineTo(-r * 0.5, -r * 0.45); g.moveTo(-r, 0); g.lineTo(-r * 0.5, r * 0.45); g.moveTo(r, 0); g.lineTo(r * 0.5, -r * 0.45); g.moveTo(r, 0); g.lineTo(r * 0.5, r * 0.45); g.stroke(); }
    else if (kind === "touch") { g.arc(0, 0, r * 0.9, 0, 7); g.moveTo(0, -r * 0.55); g.lineTo(0, 0); g.lineTo(r * 0.45, r * 0.25); g.stroke(); }
    else if (kind === "power") { for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g[i ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); }
    else if (kind === "precision") { g.arc(0, 0, r * 0.7, 0, 7); g.moveTo(-r, 0); g.lineTo(-r * 0.35, 0); g.moveTo(r, 0); g.lineTo(r * 0.35, 0); g.moveTo(0, -r); g.lineTo(0, -r * 0.35); g.moveTo(0, r); g.lineTo(0, r * 0.35); g.stroke(); }
    else if (kind === "sprint") { g.moveTo(-r, -r * 0.6); g.lineTo(-r * 0.2, 0); g.lineTo(-r, r * 0.6); g.moveTo(r * 0.1, -r * 0.6); g.lineTo(r * 0.9, 0); g.lineTo(r * 0.1, r * 0.6); g.stroke(); }
    else { g.rect(-r * 0.8, -r * 0.55, r * 1.6, r * 1.1); g.moveTo(-r * 0.8, 0); g.lineTo(r * 0.8, 0); g.stroke(); }
    g.restore();
  }

  Duel.prototype._drawCapsule = function (g) {
    var c = this.capsule; if (!c) return;
    var age = this.now - c.born, t = Math.min(1, age / 0.9);
    var z = t < 1 ? 12 * (1 - t) * (1 - t) + 0.9 : 0.9 + Math.sin(this.now * 4) * 0.15;
    if (c.until - this.now < 1.5 && Math.sin(this.now * 22) < 0) return;   // blink before vanishing
    var gp = this._project(c.x, c.y, 0), p = this._project(c.x, c.y, z), rgb = POWER_RGB[c.kind], w = 2.4 * p.s, h = 1.25 * p.s;
    g.save();
    g.fillStyle = "rgba(0,0,30,0.3)"; g.beginPath(); g.ellipse(gp.x, gp.y, w * 0.5, h * 0.3, 0, 0, 7); g.fill();
    g.globalCompositeOperation = "lighter";
    var gl = g.createRadialGradient(p.x, p.y, h * 0.3, p.x, p.y, w * 1.1);
    gl.addColorStop(0, "rgba(" + rgb + ",0.55)"); gl.addColorStop(1, "rgba(" + rgb + ",0)");
    g.fillStyle = gl; g.beginPath(); g.arc(p.x, p.y, w * 1.1, 0, 7); g.fill();
    g.globalCompositeOperation = "source-over";
    var gr = g.createLinearGradient(0, p.y - h / 2, 0, p.y + h / 2);
    gr.addColorStop(0, "rgb(" + rgb + ")"); gr.addColorStop(1, "rgba(" + rgb + ",0.7)");
    g.beginPath();
    if (g.roundRect) g.roundRect(p.x - w / 2, p.y - h / 2, w, h, h / 2); else g.rect(p.x - w / 2, p.y - h / 2, w, h);
    g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = "#ffffff"; g.stroke();
    g.translate(p.x, p.y); capIcon(g, c.kind, h * 0.32);
    g.restore();
  };

  // Rally counter: the longer the rally, the faster the ball and the hotter the colour.
  Duel.prototype._drawRally = function (g) {
    var b = this.ball;
    if (this.phase !== "rally" || !b || !b.live || b.dead || b.hits < 4) return;
    var heat = clamp((b.hits - 3) * 0.035 / 0.3, 0, 1), W = this.W, H = this.H, size = Math.round(W * 0.045);
    g.save(); g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.font = "800 " + size + "px system-ui, -apple-system, 'Segoe UI', sans-serif";
    g.lineWidth = Math.max(3, size * 0.2); g.strokeStyle = "rgba(4,8,20,0.75)";
    var label = String(this.t.rallyLabel || "RALLY {n}").replace("{n}", b.hits);
    g.strokeText(label, W / 2, H * 0.078);
    g.fillStyle = "hsl(" + Math.round(52 - heat * 44) + ",100%,62%)"; g.fillText(label, W / 2, H * 0.078);
    g.restore();
  };

  // ───────────────────────── Power visuals ─────────────────────────
  // Polygon on the court plane (a circle in world feet), so rings follow the perspective.
  Duel.prototype._ring = function (g, x, y, r, a0, a1, close) {
    g.beginPath();
    for (var i = 0; i <= 48; i++) {
      var a = a0 + (a1 - a0) * i / 48, p = this._project(x + Math.cos(a) * r, y + Math.sin(a) * r, 0);
      if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
    }
    if (close) g.closePath();
  };

  // Under the actors: aura with a shrinking time arc, plus one signature effect per power.
  Duel.prototype._drawPowerFx = function (g) {
    var key = this._pw("any") ? this.power.key : "";
    if (key !== "sprint") this._ghosts = null;
    if (!key) return;
    var h = this.human, now = this.now, rgb = POWER_RGB[key], col = "rgb(" + rgb + ")";
    var left = clamp((this.power.until - now) / POWER_SECONDS, 0, 1);
    var calm = !!(this.fx && this.fx.reduced), pulse = calm ? 0 : Math.sin(now * 7);
    var blink = (left < 0.2 && !calm) ? (Math.sin(now * 24) > 0 ? 1 : 0.35) : 1, i;
    g.save(); g.lineCap = "round"; g.lineJoin = "round";
    this._ring(g, h.x, h.y, 2.4 + pulse * 0.12, 0, Math.PI * 2, true);
    g.fillStyle = "rgba(" + rgb + "," + (0.22 * blink).toFixed(2) + ")"; g.fill();
    g.strokeStyle = col; g.lineWidth = 3; g.globalAlpha = 0.9 * blink; g.stroke();
    this._ring(g, h.x, h.y, 3.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left, false);
    g.lineWidth = 4; g.globalAlpha = 0.95; g.stroke();
    g.globalAlpha = 1;
    if (key === "reach") {
      this._ring(g, h.x, h.y, 4.7 * 1.35, 0, Math.PI * 2, true);
      g.setLineDash([8, 6]); g.lineWidth = 2.5; g.globalAlpha = 0.75 * blink; g.stroke(); g.setLineDash([]);
    } else if (key === "touch") {
      for (i = 0; i < 2; i++) {
        var ph = (now * 0.8 + i * 0.5) % 1;
        this._ring(g, h.x, h.y, 1.5 + ph * 6, 0, Math.PI * 2, true);
        g.lineWidth = 2.5; g.globalAlpha = (1 - ph) * 0.55; g.stroke();
      }
    } else if (key === "pass") {
      this._quad(g, -CW, -KIT, CW, 0, "rgba(" + rgb + "," + (0.2 + 0.09 * pulse).toFixed(2) + ")");
      g.globalAlpha = 0.9; g.strokeStyle = col; this._line(g, -CW, -KIT, CW, -KIT, 0.35);
    } else if (key === "sprint") {
      var gp = this._project(h.x, h.y, 0), gh = this._ghosts || (this._ghosts = []);
      if (!gh.length || Math.hypot(gp.x - gh[gh.length - 1].x, gp.y - gh[gh.length - 1].y) > 3) gh.push({ x: gp.x, y: gp.y });
      if (gh.length > 12) gh.shift();
      for (i = 0; i < gh.length; i++) {
        var k = (i + 1) / gh.length;
        g.globalAlpha = 0.34 * k * blink; g.fillStyle = col;
        g.beginPath(); g.ellipse(gh[i].x, gh[i].y, 1.7 * gp.s * k, 0.55 * gp.s * k, 0, 0, 7); g.fill();
      }
    } else if (key === "power" && !calm && Math.random() < 0.6) {
      var ep = this._project(h.x, h.y, 3.5);
      this.fx.burst(ep.x + (Math.random() - 0.5) * 16, ep.y, [col, "#ffd60a"], 1, { speed: 40, up: 110, life: 520, gravity: -60, size: 2.4 });
    }
    g.restore();
  };

  // Over everything: a coloured vignette while a power runs, and a short flash when it fires.
  Duel.prototype._drawPowerTint = function (g) {
    var key = this._pw("any") ? this.power.key : "";
    var fl = (this.flashUntil || 0) > this.now ? ((this.flashUntil - this.now) / 0.3) : 0;
    if (!key && !fl) return;
    var W = this.W, H = this.H, calm = !!(this.fx && this.fx.reduced);
    if (key) {
      var rgb = POWER_RGB[key], left = clamp((this.power.until - this.now) / POWER_SECONDS, 0, 1);
      var a = 0.26 + (calm ? 0 : 0.06 * Math.sin(this.now * 5)), blink = (left < 0.2 && !calm) ? (Math.sin(this.now * 24) > 0 ? 1 : 0.4) : 1;
      var v = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
      v.addColorStop(0, "rgba(" + rgb + ",0)"); v.addColorStop(1, "rgba(" + rgb + "," + (a * blink).toFixed(3) + ")");
      g.fillStyle = v; g.fillRect(0, 0, W, H);
    }
    if (fl && !calm) { g.fillStyle = "rgba(" + POWER_RGB[this._flashKey || "power"] + "," + (0.38 * fl).toFixed(3) + ")"; g.fillRect(0, 0, W, H); }
  };

  // ───────────────────────── Focus time (slow motion at contact) ─────────────────────────
  Duel.prototype._slowScale = function () { var v = clamp(0.16 + (this.drill ? 0 : this.stage) * 0.035, 0.16, 0.4); return this._pw("touch") ? v * 0.7 : v; };
  Duel.prototype._slowBudget = function () { return clamp(1.1 - (this.drill ? 0 : this.stage) * 0.1, 0.5, 1.1) * (this._pw("touch") ? 1.8 : 1) * this._pstat("focus") * (this.daily ? 1 : DIFFICULTIES[this.drill ? DRILLS[this.drill.id].difficulty : this.save.difficulty].focus) * ((!this.daily && !this.drill && !this.save.coached && this.stage === 0) ? 1.6 : 1); };   // real seconds per ball

  Duel.prototype._wantSlow = function (realDt) {
    var b = this.ball, h = this.human;
    if (this.phase !== "rally" || !b || !b.live || b.dead || b.lastHitTeam !== 1 || b.y > 0.6) return false;
    if (this.now < h.swingUntil) return false;                       // committed: play it out at full speed
    if (!(b.bounces >= 1 || b.hits >= 3)) return false;              // never slow down on a ball that must still bounce
    if (b.bounces === 0 && Math.abs(h.y) < KIT) return false;        // nor on an illegal kitchen volley
    var d = Math.hypot(b.x - h.x, b.y - h.y);
    if (d > 5.6 || b.z > 8.6) return false;
    if (this.slowBallId !== b.id) { this.slowBallId = b.id; this.slowLeft = this._slowBudget(); }
    if (this.slowLeft <= 0) return false;
    this.slowLeft -= realDt;
    return true;
  };

  Duel.prototype._drawFocus = function (g) {
    var k = clamp((1 - this.timeScale) / 0.6, 0, 1);
    if (k < 0.02) return;
    var W = this.W, H = this.H;
    var v = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.32, W / 2, H * 0.55, Math.max(W, H) * 0.72);
    v.addColorStop(0, "rgba(8,12,40,0)");
    v.addColorStop(1, "rgba(8,12,40," + (0.62 * k).toFixed(3) + ")");
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    // Remaining focus time, drawn as a shrinking ring around the ball
    var p = this._ballScreen;
    if (p) {
      var frac = clamp(this.slowLeft / this._slowBudget(), 0, 1);
      g.strokeStyle = "rgba(255,214,10," + (0.95 * k).toFixed(3) + ")"; g.lineWidth = 4; g.lineCap = "round";
      g.beginPath(); g.arc(p.x, p.y, Math.max(18, 1.5 * p.s), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); g.stroke();
    }
    g.globalAlpha = k;
    g.font = "800 " + Math.round(Math.min(W, H) * 0.045) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 5; g.strokeStyle = "rgba(8,12,40,0.8)"; g.fillStyle = "#ffd60a"; g.lineJoin = "round";
    var label = String(this.t.focus || "AIM!");
    g.strokeText(label, W / 2, H * 0.3); g.fillText(label, W / 2, H * 0.3);
    g.globalAlpha = 1;
  };

  Duel.prototype._drawTouchHints = function (g) {
    if (!(("ontouchstart" in window) || navigator.maxTouchPoints > 0) || this.phase === "menu") return;
    var W = this.W, H = this.H, t = this.t;
    if (this.joy) {
      g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 2; g.beginPath(); g.arc(this.joy.ox, this.joy.oy, 46, 0, 7); g.stroke();
      var dx = clamp(this.joy.x - this.joy.ox, -46, 46), dy = clamp(this.joy.y - this.joy.oy, -46, 46);
      g.fillStyle = "rgba(255,255,255,0.75)"; g.beginPath(); g.arc(this.joy.ox + dx, this.joy.oy + dy, 20, 0, 7); g.fill();
    }
    if (this.swipe) {
      g.strokeStyle = "rgba(255,214,10,0.9)"; g.lineWidth = 5; g.lineCap = "round";
      g.beginPath(); g.moveTo(this.swipe.ox, this.swipe.oy); g.lineTo(this.swipe.x, this.swipe.y); g.stroke();
    }
    if (!this.joy && !this.swipe && (this.phase === "serve" || (this.phase === "rally" && this.timeScale < 0.7))) {
      g.font = "700 13px system-ui, sans-serif"; g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,0.85)";
      g.fillText(String(t.hintMove || "MOVE"), W * 0.25, H - 34);
      g.fillText(String(t.hintHit || "SWIPE TO HIT"), W * 0.75, H - 34);
    }
  };

  Duel.prototype._frame = function (ts) {
    if (!this.root) return;
    var dt = this.lastTs ? clamp((ts - this.lastTs) / 1000, 0, 0.05) : 0.016;
    this.lastTs = ts;
    var frozen = this.freezeUntil && this.now < this.freezeUntil;
    // Focus time: the world slows while the ball is in reach so the shot can be chosen.
    var want = this._wantSlow(dt) ? this._slowScale() : 1;
    this.timeScale += (want - this.timeScale) * Math.min(1, dt * 16);
    var rdt = dt;
    dt *= this.timeScale;
    this.now += dt;
    this.realNow = (this.realNow || 0) + rdt;
    if (!frozen && !this.paused) this._update(dt);
    this._powerHud();
    this._coachTick();

    var g = this.ctx, W = this.W, H = this.H, self = this;
    if (!this._bg || this._bgVenue !== this._venueId()) this._drawBackground();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this._bg, 0, 0);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.save();
    if (this.shakeUntil > this.now) g.translate((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);
    var z = this.fx ? this.fx.getZoom(this.now * 1000) : 1;
    if (z !== 1) { g.translate(W / 2, H * 0.55); g.scale(z, z); g.translate(-W / 2, -H * 0.55); }

    if (this.drill && this.phase !== "point") this._drawDrillTarget(g);
    this._drawAim(g);
    this._drawPowerFx(g);
    this._drawCapsule(g);
    var far = this.actors.filter(function (a) { return a.team === 1; }).sort(function (a, b) { return b.y - a.y; });
    var near = this.actors.filter(function (a) { return a.team === 0; }).sort(function (a, b) { return b.y - a.y; });
    var b = this.ball, ballFar = b && b.y > 0;
    far.forEach(function (a) { if (b && ballFar && b.y > a.y) self._drawBall(g); self._drawActor(g, a); });
    if (ballFar && !far.some(function (a) { return b.y > a.y; })) this._drawBall(g);
    this._drawNet(g);
    var drawn = false;
    near.forEach(function (a) { if (b && !ballFar && !drawn && b.y > a.y) { self._drawBall(g); drawn = true; } self._drawActor(g, a); });
    if (b && !ballFar && !drawn) this._drawBall(g);
    if (this.fx) this.fx.draw(g, W, H, this.now * 1000, { combo: 0 });
    g.restore();
    this._drawPowerTint(g);
    this._drawRally(g);
    this._drawFocus(g);
    this._drawTouchHints(g);
  };

  window.KR_DUEL = {
    start: function (opts) { return new Duel(opts || {}); },
    ladder: LADDER,
    _test: { seeded: seeded, dailyInfo: dailyInfo, aimToShot: aimToShot, POWERS: POWERS, cast: PLAYERS }
  };
})();
