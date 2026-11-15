// fx.js - arcade visual effects layer for Kitchen Rush
// Arena backdrop, particles, ball comet trail, camera punch, combo meter.
// Purely cosmetic: never touches game state. Safe to remove (ui.js guards every call).

(() => {
  "use strict";

  var MAX_PARTICLES = 140;
  var TRAIL_LEN = 12;

  function prefersReducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (_) { return false; }
  }

  function FX() {
    this.particles = [];
    this.trail = [];
    this.rings = [];
    this.punchAt = 0;
    this.punchStrength = 0;
    this.comboBumpAt = 0;
    this.lastCombo = 0;
    this.lastTs = 0;
    this.reduced = prefersReducedMotion();
    this._bg = null;
    this._bgKey = "";
  }

  FX.prototype.reset = function () {
    this.particles.length = 0;
    this.trail.length = 0;
    this.rings.length = 0;
    this.punchAt = 0;
    this.punchStrength = 0;
    this.comboBumpAt = 0;
    this.lastCombo = 0;
    this.lastTs = 0;
    this.reduced = prefersReducedMotion();
  };

  // ── Backdrop: night arena, cached in an offscreen canvas ──
  FX.prototype.drawBackdrop = function (ctx, w, h, tint) {
    var key = w + "x" + h + ":" + (tint || "");
    if (!this._bg || this._bgKey !== key) {
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      var g = c.getContext("2d");
      if (!g) return false;

      var sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#070b1f");
      sky.addColorStop(0.45, tint || "#101a3d");
      sky.addColorStop(1, "#060a18");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);

      // Stadium light cones
      var cones = [[0.12, "88,160,255"], [0.88, "255,120,90"]];
      for (var i = 0; i < cones.length; i++) {
        var cx = w * cones[i][0];
        var cone = g.createRadialGradient(cx, -h * 0.05, 0, cx, -h * 0.05, h * 0.75);
        cone.addColorStop(0, "rgba(" + cones[i][1] + ",0.30)");
        cone.addColorStop(0.5, "rgba(" + cones[i][1] + ",0.07)");
        cone.addColorStop(1, "rgba(" + cones[i][1] + ",0)");
        g.fillStyle = cone;
        g.fillRect(0, 0, w, h);
      }

      // Crowd bokeh along the top
      var seed = 1337;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      for (var b = 0; b < 46; b++) {
        var bx = rnd() * w, by = rnd() * h * 0.09, br = 1 + rnd() * 2.2;
        g.fillStyle = "rgba(" + (rnd() > 0.5 ? "255,214,140" : "150,200,255") + "," + (0.10 + rnd() * 0.22).toFixed(2) + ")";
        g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
      }

      // Floor glow under the court
      var floor = g.createRadialGradient(w / 2, h * 0.62, w * 0.1, w / 2, h * 0.62, w * 0.95);
      floor.addColorStop(0, "rgba(64,224,208,0.13)");
      floor.addColorStop(1, "rgba(64,224,208,0)");
      g.fillStyle = floor;
      g.fillRect(0, 0, w, h);

      this._bg = c;
      this._bgKey = key;
    }
    ctx.drawImage(this._bg, 0, 0);
    return true;
  };

  // ── Particles ──
  FX.prototype.burst = function (x, y, color, count, opts) {
    if (this.reduced || !Number.isFinite(x) || !Number.isFinite(y)) return;
    opts = opts || {};
    var speed = opts.speed || 260;
    var life = opts.life || 520;
    var gravity = opts.gravity == null ? 520 : opts.gravity;
    var up = opts.up || 0;
    for (var i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      var a = Math.random() * Math.PI * 2;
      var s = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - up,
        g: gravity,
        life: life * (0.6 + Math.random() * 0.4),
        age: 0,
        r: (opts.size || 3) * (0.6 + Math.random() * 0.8),
        color: Array.isArray(color) ? color[i % color.length] : color,
        rect: !!opts.rect,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12
      });
    }
  };

  FX.prototype.ring = function (x, y, color, maxR, life) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (this.rings.length > 6) this.rings.shift();
    this.rings.push({ x: x, y: y, color: color, maxR: maxR || 60, life: life || 380, age: 0 });
  };

  FX.prototype.confetti = function (w, h) {
    var palette = ["#ffd60a", "#06d6a0", "#44ccff", "#ff6b4a", "#c9a6ff", "#ffffff"];
    for (var i = 0; i < 4; i++) {
      this.burst(w * (0.2 + 0.2 * i), h * 0.34, palette, 12, { speed: 340, life: 1100, gravity: 620, up: 220, size: 4, rect: true });
    }
  };

  FX.prototype.punch = function (strength, now) {
    if (this.reduced) return;
    this.punchAt = now;
    this.punchStrength = strength;
  };

  // Camera zoom factor (1 = none). Short ease-out pulse after a strong hit.
  FX.prototype.getZoom = function (now) {
    var t = (now - this.punchAt) / 180;
    if (t < 0 || t >= 1 || !this.punchStrength) return 1;
    return 1 + this.punchStrength * (1 - t) * (1 - t);
  };

  // ── Ball comet trail (screen space) ──
  FX.prototype.trailPush = function (id, x, y, r, color) {
    var last = this.trail[this.trail.length - 1];
    if (last && last.id !== id) this.trail.length = 0;
    this.trail.push({ id: id, x: x, y: y, r: r, color: color });
    if (this.trail.length > TRAIL_LEN) this.trail.shift();
  };

  FX.prototype.trailClear = function () { this.trail.length = 0; };

  FX.prototype.drawTrail = function (ctx, quality) {
    var t = this.trail;
    if (this.reduced || quality >= 2 || t.length < 3) return;
    var step = quality >= 1 ? 2 : 1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < t.length - 1; i += step) {
      var k = (i + 1) / t.length;
      ctx.globalAlpha = 0.34 * k * k;
      ctx.fillStyle = t[i].color;
      ctx.beginPath();
      ctx.arc(t[i].x, t[i].y, Math.max(1.5, t[i].r * (0.35 + 0.6 * k)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // ── Per-frame update + draw (particles, rings, combo meter) ──
  FX.prototype.draw = function (ctx, w, h, now, opts) {
    opts = opts || {};
    var dt = this.lastTs ? Math.min(50, now - this.lastTs) : 16;
    this.lastTs = now;
    var dts = dt / 1000;
    var i;

    // Rings
    for (i = this.rings.length - 1; i >= 0; i--) {
      var rg = this.rings[i];
      rg.age += dt;
      if (rg.age >= rg.life) { this.rings.splice(i, 1); continue; }
      var rt = rg.age / rg.life;
      var ease = 1 - (1 - rt) * (1 - rt);
      ctx.save();
      ctx.globalAlpha = 0.75 * (1 - rt);
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = 4 * (1 - rt) + 1;
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, 10 + rg.maxR * ease, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Particles
    if (this.particles.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (i = this.particles.length - 1; i >= 0; i--) {
        var p = this.particles[i];
        p.age += dt;
        if (p.age >= p.life) { this.particles.splice(i, 1); continue; }
        p.vy += p.g * dts;
        p.vx *= 0.985;
        p.x += p.vx * dts;
        p.y += p.vy * dts;
        var pt = p.age / p.life;
        ctx.globalAlpha = Math.max(0, 1 - pt * pt);
        ctx.fillStyle = p.color;
        if (p.rect) {
          p.rot += p.vr * dts;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 - pt * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Combo meter
    var combo = Number(opts.combo || 0);
    if (combo !== this.lastCombo) {
      if (combo > this.lastCombo) this.comboBumpAt = now;
      this.lastCombo = combo;
    }
    var minCombo = Number(opts.comboMin || 3);
    if (combo >= minCombo) {
      var bump = Math.max(0, 1 - (now - this.comboBumpAt) / 220);
      var heat = Math.min(1, (combo - minCombo) / 20);
      var size = Math.round(w * (0.05 + heat * 0.02) * (1 + (this.reduced ? 0 : bump * 0.35)));
      var cy = h * 0.115;
      var hue = Math.round(48 - heat * 40);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 " + size + "px system-ui, -apple-system, 'Segoe UI', sans-serif";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(3, size * 0.18);
      ctx.strokeStyle = "rgba(4,8,20,0.75)";
      var label = "×" + combo;
      ctx.strokeText(label, w / 2, cy);
      ctx.fillStyle = "hsl(" + hue + ",100%," + Math.round(62 + bump * 20) + "%)";
      ctx.fillText(label, w / 2, cy);
      var sub = String(opts.comboLabel || "").trim();
      if (sub) {
        ctx.font = "700 " + Math.round(w * 0.024) + "px system-ui, -apple-system, 'Segoe UI', sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.fillText(sub, w / 2, cy + size * 0.78);
      }
      ctx.restore();

      // Heat border: the arena warms up with the streak.
      if (heat > 0.15 && !opts.lowQuality) {
        var edge = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
        edge.addColorStop(0, "hsla(" + hue + ",100%,55%,0)");
        edge.addColorStop(1, "hsla(" + hue + ",100%,55%," + (0.22 * heat).toFixed(3) + ")");
        ctx.fillStyle = edge;
        ctx.fillRect(0, 0, w, h);
      }
    }
  };

  window.KR_FX = { create: function () { return new FX(); } };
})();
