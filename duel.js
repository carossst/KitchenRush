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
  var STORE_KEY = "kr:duel";

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
      pal: { jerseyA: "#3a3a4a", jerseyB: "#11111a", shorts: "#000000", hair: "#101018", band: "#ffd60a", paddle: "#ffd60a", trim: "#ffd60a" } }
  ];
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
  var POWER_SECONDS = 10, CHARGE_MAX = 3;
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
    d.bestMargin = clamp(Math.floor(Number(d.bestMargin) || 0), 0, 99);
    d.lang = (d.lang === "fr" || d.lang === "en") ? d.lang : "";
    var dd = d.daily;
    d.daily = (dd && typeof dd === "object" && /^\d{4}-\d{2}-\d{2}$/.test(String(dd.key)))
      ? { key: String(dd.key), you: clamp(Math.floor(Number(dd.you) || 0), 0, 99), them: clamp(Math.floor(Number(dd.them) || 0), 0, 99), idx: clamp(Math.floor(Number(dd.idx) || 0), 0, 99) } : null;
    return d;
  }
  function writeSave(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (_) { } }

  function Duel(opts) {
    this.opts = opts || {};
    this.save = loadSave();
    this.lang = this.save.lang || window.KR_LANG || (/^fr/i.test(navigator.language || "") ? "fr" : "en");
    this.t = this._dict();
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
    this._showMenu();
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
      '<div class="kr-duel-score" aria-live="polite"></div><span class="kr-duel-spacer"></span></div>' +
      '<div class="kr-duel-banner" aria-live="polite"></div>' +
      '<button class="kr-duel-power" hidden></button>' +
      '<div class="kr-duel-panel"></div>';
    document.body.appendChild(root);
    this.root = root;
    this.canvas = root.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.scoreEl = root.querySelector(".kr-duel-score");
    this.bannerEl = root.querySelector(".kr-duel-banner");
    this.panelEl = root.querySelector(".kr-duel-panel");
    this.powerEl = root.querySelector(".kr-duel-power");

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
    this.powerEl.addEventListener("click", function () { self._activatePower(); });
    this.panelEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-duel]");
      if (b) self._panelAction(b.getAttribute("data-duel"));
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
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this._onResize);
    document.removeEventListener("keydown", this._onKey);
    document.removeEventListener("keyup", this._onKeyUp);
    document.removeEventListener("visibilitychange", this._onVis);
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    if (typeof this.opts.onExit === "function") this.opts.onExit();
  };

  Duel.prototype._sound = function (name) { try { if (this.opts.sound) this.opts.sound(name); } catch (_) { } };

  Duel.prototype._opp = function () {
    if (this.daily) return LADDER[this.daily.idx];
    var base = LADDER[Math.min(this.stage, LADDER.length - 1)];
    var extra = Math.max(0, this.stage - (LADDER.length - 1));
    if (!extra) return base;
    var o = Object.assign({}, base);
    o.speed += extra * 0.5; o.err = Math.max(0.5, o.err - extra * 0.08); o.react = Math.max(0.08, o.react - extra * 0.01);
    return o;
  };

  Duel.prototype._showMenu = function (result) {
    this.phase = "menu";
    var t = this.t, opp = this._opp();
    var head = "";
    var sc = this._lastScore, fin = (result && sc) ? ' <span class="kr-duel-final">' + sc[0] + '\u2013' + sc[1] + '</span>' : "";
    if (result === "win") head = '<p class="kr-duel-result kr-duel-result--win">' + esc(t.win || "You win!") + fin + '</p>';
    if (result === "lose") head = '<p class="kr-duel-result kr-duel-result--lose">' + esc(t.lose || "So close. Run it back.") + fin + '</p>';
    var m = this.mode, s = this.side;
    function opt(id, label, on) { return '<button class="kr-duel-opt' + (on ? " kr-duel-opt--on" : "") + '" data-duel="' + id + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(label) + '</button>'; }
    var touch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    this.panelEl.innerHTML =
      '<div class="kr-duel-card">' + head +
      '<p class="kr-duel-kicker">' + esc((t.stageLabel || "Opponent {n}").replace("{n}", this.stage + 1)) + '</p>' +
      '<h2 class="kr-duel-name">' + esc(opp.name) + '</h2>' +
      '<p class="kr-muted">' + esc((t.tags && t.tags[Math.min(this.stage, LADDER.length - 1)]) || opp.tag || "") + '</p>' +
      (opp.trait && t.traits ? '<p class="kr-muted kr-duel-trait">' + esc((t.traitLabel || "Style: {x}").replace("{x}", t.traits[opp.trait] || "")) + '</p>' : "") +
      this._statsHtml(result) +
      '<div class="kr-duel-opts" role="group" aria-label="' + esc(t.modeAria || "Match type") + '">' +
        opt("singles", t.singles || "Singles", m === "singles") +
        opt("left", t.doublesLeft || "Doubles · Left", m === "doubles" && s === "left") +
        opt("right", t.doublesRight || "Doubles · Right", m === "doubles" && s === "right") +
      '</div>' +
      '<button class="kr-btn kr-btn--secondary kr-duel-look" data-duel="look">' + esc(t.changeLook || "Change my look") + '</button>' +
      '<p class="kr-duel-how">' + esc(touch ? (t.howTouch || "Drag to move. When time slows, swipe toward where you want the ball.") : (t.howKeys || "Arrows / WASD: move. Space: hit — hold a direction to aim. Or click where you want the ball.")) + '</p>' +
      '<p class="kr-duel-how">' + esc(t.rules || "First to 5. Serve and return must bounce. No volleys in the Kitchen.") + '</p>' +
      '<button class="kr-btn kr-btn--primary kr-duel-go" data-duel="go">' + esc(result ? (result === "win" ? (t.next || "Next opponent") : (t.retry || "Rematch")) : (t.start || "Start match")) + '</button>' +
      '<button class="kr-btn kr-btn--ghost" data-duel="exit">' + esc(t.home || "Back to menu") + '</button>' +
      '<button class="kr-btn kr-btn--ghost kr-duel-lang" data-duel="lang" lang="' + (this.lang === "fr" ? "en" : "fr") + '">' + (this.lang === "fr" ? "English" : "Fran\u00e7ais") + '</button>' +
      '</div>';
    this.panelEl.classList.add("kr-duel-panel--on");
    this.scoreEl.textContent = "";
    this._setupActors();
    var go = this.panelEl.querySelector(".kr-duel-go");
    if (go) try { go.focus({ preventScroll: true }); } catch (_) { }
  };

  // Progress block of the match menu: last results, record, goal for the next match, opponents beaten.
  Duel.prototype._statsHtml = function (result) {
    var t = this.t, sv = this.save, h = sv.history || [], opp = this._opp(), sc = this._lastScore;
    var self = this, wl = String(t.winLetter || "W"), ll = String(t.loseLetter || "L");
    var goal;
    if (result && this._lastDailyIdx != null && sc) goal = (t.dailyGoal || "Daily Duel: {you}\u2013{them} vs {name}. Back tomorrow!").replace("{you}", sc[0]).replace("{them}", sc[1]).replace("{name}", LADDER[this._lastDailyIdx].name);
    else if (result === "lose" && sc) goal = (t.goalLose || "Lost {you}\u2013{them}. Beat {name} to move up.").replace("{you}", sc[0]).replace("{them}", sc[1]).replace("{name}", opp.name);
    else if (result === "win") goal = (t.goalNext || "Next: beat {name}").replace("{name}", opp.name);
    else goal = (t.goalFirst || "Beat {name} to move up the ladder.").replace("{name}", opp.name);
    var out = '<p class="kr-duel-goal">' + esc(goal) + '</p>';
    if (h.length) {
      out += '<div class="kr-duel-recent" role="list" aria-label="' + esc(t.recent || "Last matches") + '">' + h.slice(-5).map(function (e) {
        var w = e.you > e.them;
        return '<span role="listitem" class="kr-duel-dot kr-duel-dot--' + (w ? "w" : "l") + '" title="' + e.you + '\u2013' + e.them + '">' + esc(w ? wl : ll) + '</span>';
      }).join("") + '</div>';
      out += '<p class="kr-muted">' + esc((t.record || "Wins {w} \u00b7 Best margin +{m}").replace("{w}", Number(sv.wins) || 0).replace("{m}", sv.bestMargin || 0)) + '</p>';
    }
    out += this._dailyHtml();
    out += '<div class="kr-duel-chips" aria-label="' + esc(t.collection || "Opponents beaten") + '">' + LADDER.map(function (o, i) {
      var on = sv.beaten && sv.beaten[i];
      if (!on) return '<span class="kr-duel-chip">?</span>';
      var eq = POWERS[i] === self._equippedKey();
      return '<button class="kr-duel-chip kr-duel-chip--on' + (eq ? " kr-duel-chip--eq" : "") + '" data-duel="eq-' + i + '" aria-pressed="' + (eq ? "true" : "false") + '" title="' + esc((t.powerDescs || [])[i] || "") + '">' + (eq ? "\u2605 " : "\u2713 ") + esc(o.name) + '</button>';
    }).join("") + '</div>' + this._powerLine();
    return '<div class="kr-duel-stats">' + out + '</div>';
  };

  // ───────────────────────── Powers ─────────────────────────
  Duel.prototype._pw = function (key) {
    var p = this.power;
    if (!p || this.now >= p.until) return false;
    return key === "any" || p.key === key;
  };

  // Equipped power if owned, else the most recently earned one, else "".
  Duel.prototype._equippedKey = function () {
    var sv = this.save, owned = function (key) { return !!(sv.beaten && sv.beaten[POWERS.indexOf(key)]); };
    if (sv.equipped && owned(sv.equipped)) return sv.equipped;
    for (var i = POWERS.length - 1; i >= 0; i--) if (owned(POWERS[i])) return POWERS[i];
    return "";
  };

  Duel.prototype._powerName = function (key) { var i = POWERS.indexOf(key); return (this.t.powerNames || [])[i] || key; };

  Duel.prototype._powerLine = function () {
    var t = this.t, key = this._equippedKey();
    if (!key) return '<p class="kr-muted kr-duel-powerline">' + esc(t.powerNone || "Beat an opponent to earn a power.") + '</p>';
    var i = POWERS.indexOf(key);
    return '<p class="kr-muted kr-duel-powerline">' + esc((t.powerEquip || "Power: {name} \u2014 {desc}").replace("{name}", this._powerName(key)).replace("{desc}", (t.powerDescs || [])[i] || "")) + '</p>';
  };

  Duel.prototype._activatePower = function () {
    var key = this._equippedKey();
    if (!key || this.daily || this.phase === "menu" || (this.charge || 0) < CHARGE_MAX || this._pw("any")) return;
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
    else if ((this.charge || 0) >= CHARGE_MAX) { state = "ready"; txt = (t.powerReady || "{name} READY").replace("{name}", name); }
    else { state = "charge"; txt = (t.powerCharge || "{name} {n}/3").replace("{name}", name).replace("{n}", this.charge || 0); }
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
        '<button class="kr-btn kr-btn--secondary kr-duel-share" data-duel="share">' + esc(t.share || "Share") + '</button>';
    }
    return '<button class="kr-btn kr-btn--secondary kr-duel-daily" data-duel="daily">' + esc((t.dailyBtn || "Daily Duel \u00b7 vs {name}").replace("{name}", LADDER[di.idx].name)) + '</button>';
  };

  // Copy / share today's result (text only: score and opponent, no personal data).
  Duel.prototype._share = function () {
    var t = this.t, di = dailyInfo(), d = this.save.daily;
    if (!d || d.key !== di.key) return;
    var text = (t.shareText || "Kitchen Rush Daily Duel {date}: {you}\u2013{them} vs {name}").replace("{date}", d.key).replace("{you}", d.you).replace("{them}", d.them).replace("{name}", LADDER[d.idx % LADDER.length].name) + "\n" + location.origin + location.pathname + "?lang=" + this.lang;
    var btn = this.panelEl.querySelector('[data-duel="share"]'), self = this;
    function done(ok) { if (btn) { btn.textContent = ok ? (t.copied || "Copied!") : (t.copyFailed || "Copy failed"); setTimeout(function () { if (btn && self.root) btn.textContent = t.share || "Share"; }, 1600); } }
    try {
      if (navigator.share) { navigator.share({ text: text }).catch(function () { }); return; }
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } catch (_) { done(false); }
  };

  Duel.prototype._panelAction = function (a) {
    if (a === "exit") { this.destroy(); return; }
    if (a.indexOf("eq-") === 0) {
      var qi = Number(a.slice(3));
      if (this.save.beaten && this.save.beaten[qi] && POWERS[qi]) { this.save.equipped = POWERS[qi]; writeSave(this.save); }
      this._showMenu(this._lastResult); return;
    }
    if (a === "go") { this.daily = null; this._startMatch(); return; }
    if (a === "daily") { var di = dailyInfo(); this.daily = di; this.mode = "singles"; this._startMatch(); return; }
    if (a === "share") { this._share(); return; }
    if (a === "lang") { this.lang = this.lang === "fr" ? "en" : "fr"; this.save.lang = this.lang; this.t = this._dict(); this._bg = null; }
    else if (a === "look") this.look = (this.look + 1) % LOOKS.length;
    else if (a === "singles") this.mode = "singles";
    else { this.mode = "doubles"; this.side = a; }
    this.save.mode = this.mode; this.save.side = this.side; this.save.look = this.look; writeSave(this.save);
    this._showMenu(this._lastResult);
  };

  // ───────────────────────── Match setup ─────────────────────────
  Duel.prototype._setupActors = function () {
    var opp = this._opp(), dbl = this.mode === "doubles";
    var hx = dbl ? (this.side === "left" ? -5 : 5) : 0;
    function actor(team, human, hx0, hy0, skill, pal, zone) {
      return { team: team, human: human, x: hx0, y: hy0, homeX: hx0, homeY: hy0, vx: 0, vy: 0, skill: skill, pal: pal, zone: zone,
        swingAnim: 0, swingUntil: 0, aimX: 0, aimY: 0, goalX: hx0, goalY: hy0, reactAt: 0, planId: -1, leave: false, side: 1 };
    }
    var A = [];
    var oppPal = Object.assign({}, opp.pal, LOOKS[opp.look % LOOKS.length]);
    var humanPal = Object.assign({}, HUMAN_PAL, LOOKS[this.look]);
    var allyLook = LOOKS[(this.look + 3) % LOOKS.length];
    this.human = actor(0, true, hx, -15, null, humanPal, dbl ? (hx < 0 ? [-99, 0] : [0, 99]) : [-99, 99]);
    A.push(this.human);
    if (dbl) A.push(actor(0, false, -hx, -15, ALLY, Object.assign({}, ALLY.pal, allyLook), hx < 0 ? [0, 99] : [-99, 0]));
    if (dbl) {
      var pal2 = Object.assign({}, opp.pal, { band: opp.pal.paddle }, LOOKS[(opp.look + 2) % LOOKS.length]);
      A.push(actor(1, false, -5, 15, opp, oppPal, [-99, 0]));
      A.push(actor(1, false, 5, 15, opp, pal2, [0, 99]));
    } else A.push(actor(1, false, 0, 15, opp, oppPal, [-99, 99]));
    this.actors = A;
    this.ball = null;
    this.score = [0, 0];
  };

  Duel.prototype._startMatch = function () {
    this.panelEl.classList.remove("kr-duel-panel--on");
    this._lastResult = null;
    this._lastDailyIdx = null;
    this.charge = 0;
    this.power = null;
    RNG = this.daily ? seeded(this.daily.seed) : Math.random;
    this._setupActors();
    this.serverTeam = 0;
    this.serveTurn = [0, 0];
    this._updateScore();
    this._beginServe();
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
    this.ball = { x: srv.x + 1.2, y: srv.y, z: 3.4, vx: 0, vy: 0, vz: 0, live: false, held: true, lastHitTeam: srv.team, bounces: 0, hits: 0, isServe: true, id: (this.ballId = (this.ballId || 0) + 1) };
    if (this.fx) this.fx.trailClear();
    this._banner(srv.human ? (this.t.yourServe || "Your serve — swing to serve") : "", 0);
  };

  Duel.prototype._updateScore = function () {
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
    if (this.timeScale < 0.7 && !this.swipe) this.swipe = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
    else if (p.x < this.W / 2 && !this.joy) this.joy = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
    else if (!this.swipe) this.swipe = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
  };
  Duel.prototype._pMove = function (e) {
    var p = this._pos(e);
    if (this.joy && this.joy.id === e.pointerId) { this.joy.x = p.x; this.joy.y = p.y; }
    if (this.swipe && this.swipe.id === e.pointerId) { this.swipe.x = p.x; this.swipe.y = p.y; }
  };
  Duel.prototype._pUp = function (e, cancelled) {
    if (this.joy && this.joy.id === e.pointerId) this.joy = null;
    if (this.swipe && this.swipe.id === e.pointerId) {
      var a = this._swipeAim();
      this.swipe = null;
      if (!cancelled) this._swing(a.x, a.y);
    }
  };
  Duel.prototype._swipeAim = function () {
    var s = this.swipe; if (!s) return { x: 0, y: 0 };
    return { x: clamp((s.x - s.ox) / 56, -1, 1), y: clamp((s.oy - s.y) / 56, -1, 1) };
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
    var pw = a.human && this._pw("power");
    var smash = !shot.loft && b.z > (pw ? 4.2 : 5.4) && Math.abs(shot.ty) > 8 && !b.held;
    var speed = (smash ? 58 : shot.speed) * (pw ? 1.15 : 1);
    if (a.human && this._pw("precision")) sigma *= 0.45;
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
    b.isServe = b.hits === 1;
    a.swingAnim = this.now + 0.3; a.swung = true;
    a.side = b.x >= a.x ? 1 : -1;
    this.phase = "rally";
    if (a.human && this.bannerEl.textContent) this._banner("", 0);
    this._sound("smash");
    var p = this._project(b.x, b.y, b.z);
    if (this.fx) {
      this.fx.burst(p.x, p.y, smash ? ["#ffd60a", "#ffffff", "#ff8a3d"] : ["#ffffff", "#e8ff3a"], smash ? 20 : 8, { speed: smash ? 380 : 200, up: 40 });
      this.fx.ring(p.x, p.y, smash ? "#ffd60a" : "#ffffff", smash ? 70 : 34);
      if (smash) this.fx.punch(0.025, this.now * 1000);
    }
    if (smash) this.freezeUntil = this.now + 0.06;
    void dir;
  };

  Duel.prototype._tryHit = function (a, shot, sigma) {
    var b = this.ball;
    // A dead ball (point already awarded, e.g. into the net) must never be hit: that restarted the rally phase and froze the match.
    if (!b || !b.live || b.dead || b.lastHitTeam === a.team) return false;
    if (a.team === 0 ? b.y > 0.6 : b.y < -0.6) return false;
    var reach = a.human ? 4.7 * (this._pw("reach") ? 1.35 : 1) : 3.4;   // generous for the human: balls bouncing wide were hard to catch
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
      if (s > bestS) { bestS = s; best = { tx: tx, ty: ty, speed: (j === 0 ? 20 : j === 1 ? 32 : 43) * k.pace }; }
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
    var dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy), step = k.speed * dt;
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
    var b = this.ball; if (b) b.live = false;
    this.phase = "point";
    this.phaseAt = this.now;
    this.score[team] += 1;
    if (team === 0 && !this.daily && !this._pw("any")) this.charge = Math.min(CHARGE_MAX, (this.charge || 0) + 1);
    this.serveTurn[team] += (this.serverTeam === team) ? 0 : 1;
    this.serverTeam = team;
    this._updateScore();
    var t = this.t, mine = team === 0;
    var why = { out: t.out || "Out!", net: t.net || "Net!", twoBounce: t.twoBounce || "It had to bounce!", kitchen: t.kitchen || "Kitchen fault!", serveShort: t.serveShort || "Serve too short!", winner: "" }[reason] || "";
    this._banner((why ? why + " " : "") + (mine ? (t.yourPoint || "Your point") : (t.theirPoint || "Their point")), 1300, mine ? "good" : "bad");
    this._sound(mine ? "milestone" : "fault");
    if (mine && this.fx && b) { var p = this._project(b.x, b.y, b.z); this.fx.burst(p.x, p.y, ["#ffd60a", "#ffffff", "#3fd0ff"], 16, { speed: 300, up: 120, rect: true }); }
    if (!mine) this.shakeUntil = this.now + 0.2;
  };

  Duel.prototype._afterPoint = function () {
    var s = this.score, lead = Math.abs(s[0] - s[1]);
    if ((s[0] >= WIN_SCORE || s[1] >= WIN_SCORE) && lead >= 1) {
      var won = s[0] > s[1], sv = this.save, idx = Math.min(this.stage, LADDER.length - 1), isDaily = !!this.daily;
      this._lastScore = [s[0], s[1]];
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
      if (won) { if (this.fx) this.fx.confetti(this.W, this.H); this._sound("newBest"); }
      else this._sound("gameOver");
      writeSave(this.save);
      this._lastResult = won ? "win" : "lose";
      this._banner("", 0);
      var self = this;
      setTimeout(function () { if (self.root) self._showMenu(self._lastResult); }, won ? 900 : 300);
      this.phase = "menu";
      return;
    }
    this._beginServe();
  };

  Duel.prototype._stepBall = function (dt) {
    var b = this.ball; if (!b || !b.live) return;
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
      if (this.fx) this.fx.ring(p.x, p.y, "rgba(255,255,255,0.9)", 22 * p.s / 10, 260);
      var side = b.y < 0 ? 0 : 1, inCourt = Math.abs(b.x) <= CW + 0.15 && Math.abs(b.y) <= CL + 0.15;
      if (b.bounces === 1) {
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
    var spd = this._pw("sprint") ? 23 : 18;
    h.vx = mx * spd; h.vy = my * spd;
    h.x = clamp(h.x + h.vx * dt, -CW - 2, CW + 2);
    h.y = clamp(h.y + h.vy * dt, -CL - 3, -0.9);

    if (this.phase === "serve") {
      var srv = this.server; b.x = srv.x + 1.2 * (srv.team === 0 ? 1 : -1); b.y = srv.y; b.z = 3.4;
      var dir = srv.team === 0 ? 1 : -1;
      if (srv.human) {
        if (this.now < h.swingUntil && !h.swung) { var sh = aimToShot(h.aimX, Math.max(-0.1, h.aimY), dir); sh.ty = dir * Math.max(10.5, Math.abs(sh.ty)); this._launch(h, sh, 0.7, 0.1); }
      } else if (this.now - this.phaseAt > 1.1) {
        this._launch(srv, { tx: (rand() - 0.5) * 13, ty: dir * (12 + rand() * 6), speed: 34 * srv.skill.pace }, srv.skill.err * 0.6, 0.1);
      }
      this.actors.forEach(function (a) { if (!a.human && a !== srv) self._ai(a, dt); });
      return;
    }

    if (this.phase === "rally" && this.now < h.swingUntil && !h.swung) {
      if (this._tryHit(h, aimToShot(h.aimX, h.aimY, 1), 0.55)) h.swung = true;
    }
    if (this.phase === "rally" || this.phase === "point") this.actors.forEach(function (a) { if (!a.human) self._ai(a, dt); });
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

  Duel.prototype._drawBackground = function () {
    var W = this.W, H = this.H, dpr = this.dpr;
    var c = document.createElement("canvas"); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    var g = c.getContext("2d"); g.scale(dpr, dpr);
    var horizon = this._project(0, CL + 16, 0).y;
    // Sky
    var sky = g.createLinearGradient(0, 0, 0, Math.max(60, horizon));
    sky.addColorStop(0, "#2f8cff"); sky.addColorStop(1, "#aee4ff");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // Sun glow + clouds
    var sun = g.createRadialGradient(W * 0.82, horizon * 0.25, 4, W * 0.82, horizon * 0.25, W * 0.5);
    sun.addColorStop(0, "rgba(255,246,200,0.95)"); sun.addColorStop(0.12, "rgba(255,240,170,0.5)"); sun.addColorStop(1, "rgba(255,240,170,0)");
    g.fillStyle = sun; g.fillRect(0, 0, W, horizon + 10);
    g.fillStyle = "rgba(255,255,255,0.85)";
    [[0.18, 0.3, 1], [0.55, 0.16, 0.7], [0.36, 0.55, 0.55]].forEach(function (cl) {
      var cx = W * cl[0], cy = horizon * cl[1], r = W * 0.055 * cl[2];
      g.beginPath(); g.ellipse(cx, cy, r * 1.9, r * 0.62, 0, 0, 7); g.ellipse(cx - r * 0.9, cy + r * 0.12, r, r * 0.5, 0, 0, 7); g.ellipse(cx + r * 0.8, cy - r * 0.3, r * 1.1, r * 0.7, 0, 0, 7); g.fill();
    });
    // Grandstand behind the far baseline
    var st0 = this._project(-CW - 14, CL + 9, 0), st1 = this._project(CW + 14, CL + 9, 0), sh = Math.max(46, 15 * st0.s);
    var sg = g.createLinearGradient(0, st0.y - sh, 0, st0.y);
    sg.addColorStop(0, "#24407a"); sg.addColorStop(1, "#16264f");
    g.fillStyle = sg; g.beginPath(); g.roundRect ? g.roundRect(st0.x, st0.y - sh, st1.x - st0.x, sh, 10) : g.rect(st0.x, st0.y - sh, st1.x - st0.x, sh); g.fill();
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var cols = ["#ff5d8f", "#ffd60a", "#3fd0ff", "#ffffff", "#9bffb0", "#ff8a3d", "#c9a6ff"];
    var rows = 7, dot = Math.max(1.8, sh / 24);
    for (var r = 0; r < rows; r++) for (var x = st0.x + dot * 2; x < st1.x - dot * 2; x += dot * 2.7) {
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      g.beginPath(); g.arc(x + (r % 2) * dot * 1.3, st0.y - sh + dot * 2 + r * (sh - dot * 3) / rows + rnd() * 2, dot, 0, 7); g.fill();
    }
    // Ground (striped turf), wide enough to cover the screen edges
    for (var i = 0; i < 14; i++) {
      var ya = -CL - 14 + i * 5, yb = ya + 5;
      this._quad(g, -90, ya, 90, yb, i % 2 ? "#37b36b" : "#2fa862");
    }
    // Sponsor boards
    var bd0 = this._project(-CW - 9, CL + 7, 0), bd1 = this._project(CW + 9, CL + 7, 0), bh = Math.max(12, 2.6 * bd0.s);
    g.fillStyle = "#0e1b3d"; g.fillRect(bd0.x, bd0.y - bh, bd1.x - bd0.x, bh);
    g.fillStyle = "#ffd60a"; g.font = "800 " + Math.round(bh * 0.62) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    var name = String(this.opts.appName || "KITCHEN RUSH").toUpperCase();
    for (var bi = -1; bi <= 1; bi++) g.fillText(name, W / 2 + bi * (bd1.x - bd0.x) / 3, bd0.y - bh / 2);
    // Court apron + playing surface
    this._quad(g, -CW - 3, -CL - 4.5, CW + 3, CL + 4.5, "#1f7fd1");
    this._quad(g, -CW, -CL, CW, CL, "#2f6fed");
    this._quad(g, -CW, -KIT, CW, 0, "#ff7a45");
    this._quad(g, -CW, 0, CW, KIT, "#ff8d5c");
    // Soft light falloff toward the far end
    var a = this._project(0, -CL, 0), b = this._project(0, CL, 0);
    var sheen = g.createLinearGradient(0, b.y, 0, a.y);
    sheen.addColorStop(0, "rgba(10,20,60,0.22)"); sheen.addColorStop(0.5, "rgba(255,255,255,0)"); sheen.addColorStop(1, "rgba(255,255,255,0.10)");
    this._quad(g, -CW - 3, -CL - 4.5, CW + 3, CL + 4.5, sheen);
    // Lines
    g.strokeStyle = "#ffffff"; g.lineCap = "round";
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
    var p = this._project(a.x, a.y, 0), sc = p.s * (this.H / this.W > 1.25 ? 0.142 : 0.112), sp = Math.hypot(a.vx, a.vy), b = this.ball;
    var state = this.now < a.swingAnim ? "swingForehand" : (sp > 1.5 ? (Math.abs(a.vx) > Math.abs(a.vy) ? (a.vx < 0 ? "runLeft" : "runRight") : "running") : "idle");
    if (this.now >= a.swingAnim && b) a.side = b.x >= a.x ? 1 : -1;
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
    var a = this._liveAim(), sh = aimToShot(a.x, serving ? Math.max(-0.1, a.y) : a.y, 1);
    if (serving) sh.ty = Math.max(10.5, sh.ty);
    var p = this._project(sh.tx, sh.ty, 0), r = 1.7 * p.s, pulse = 1 + Math.sin(this.now * 8) * 0.08;
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
  Duel.prototype._slowScale = function () { var v = clamp(0.16 + this.stage * 0.035, 0.16, 0.4); return this._pw("touch") ? v * 0.7 : v; };
  Duel.prototype._slowBudget = function () { return clamp(1.1 - this.stage * 0.1, 0.5, 1.1) * (this._pw("touch") ? 1.8 : 1); };   // real seconds per ball

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
    if (!this.joy && !this.swipe && this.phase === "serve") {
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

    var g = this.ctx, W = this.W, H = this.H, self = this;
    if (!this._bg) this._drawBackground();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this._bg, 0, 0);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.save();
    if (this.shakeUntil > this.now) g.translate((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);
    var z = this.fx ? this.fx.getZoom(this.now * 1000) : 1;
    if (z !== 1) { g.translate(W / 2, H * 0.55); g.scale(z, z); g.translate(-W / 2, -H * 0.55); }

    this._drawAim(g);
    this._drawPowerFx(g);
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
    this._drawFocus(g);
    this._drawTouchHints(g);
  };

  window.KR_DUEL = {
    start: function (opts) { return new Duel(opts || {}); },
    ladder: LADDER,
    _test: { seeded: seeded, dailyInfo: dailyInfo, aimToShot: aimToShot, POWERS: POWERS }
  };
})();
