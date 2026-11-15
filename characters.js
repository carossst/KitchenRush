// characters.js - stylised cartoon athletes for Kitchen Rush
// Cosmetic only. ui.js calls KR_CHARACTERS.draw() from _renderPlayerV2 / _renderOpponentV2
// and falls back to the legacy silhouettes if this file is missing.
//
// Unit space: origin at hip centre, feet at y=+22, head top around y=-34 (about 56 units tall).
// The player is seen from behind (facing "back"), the opponent faces the camera ("front").

(() => {
  "use strict";

  var OUTLINE = "#0b1026";

  var PALETTES = {
    player: {
      jerseyA: "#4fd8ff", jerseyB: "#1b86e6", trim: "#ffffff", shorts: "#14275c",
      skin: "#f4c7a1", hair: "#4a2c17", band: "#ffd60a", shoe: "#ffffff", sole: "#ffd60a",
      paddle: "#ff5d8f", paddleEdge: "#ffffff", ring: "rgba(79,216,255,0.55)"
    },
    opponent: {
      jerseyA: "#c9a6ff", jerseyB: "#7b4dff", trim: "#ffffff", shorts: "#2b1a5c",
      skin: "#e2ab82", hair: "#20182e", band: "#ffffff", shoe: "#ffffff", sole: "#ff8fa3",
      paddle: "#ffd60a", paddleEdge: "#ffffff", ring: "rgba(201,166,255,0.35)"
    }
  };

  function limb(ctx, x1, y1, x2, y2, width, fill, bend) {
    // Two-pass rounded stroke: dark outline, then fill colour. Optional knee/elbow bend.
    var mx = (x1 + x2) / 2 + (bend ? bend[0] : 0);
    var my = (y1 + y2) / 2 + (bend ? bend[1] : 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? OUTLINE : fill;
      ctx.lineWidth = pass === 0 ? width + 2.2 : width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shoe(ctx, x, y, dir, pal) {
    ctx.fillStyle = pal.shoe;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(x + dir * 1.2, y, 4.6, 2.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal.sole;
    ctx.fillRect(x + dir * 1.2 - 3.6, y + 1.3, 7.2, 1.2);
  }

  function paddle(ctx, hx, hy, angle, pal) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle);
    // Handle
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(-1.6, -6, 3.2, 7);
    // Face
    roundRect(ctx, -6, -22, 12, 16.5, 4.5);
    ctx.fillStyle = pal.paddle;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = pal.paddleEdge;
    ctx.stroke();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = OUTLINE;
    roundRect(ctx, -6.9, -22.9, 13.8, 18.3, 5.2);
    ctx.stroke();
    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    roundRect(ctx, -4, -20.5, 3.2, 11, 1.6);
    ctx.fill();
    ctx.restore();
  }

  /**
   * opts: { x, y, scale, now, state, side, facing, role, lookX, lite }
   *   state  : idle | running | runLeft | runRight | runUp | runDown | swing | swingForehand | swingBackhand
   *   side   : +1 paddle on the right of the screen, -1 on the left
   *   facing : "back" (player) or "front" (opponent)
   *   lookX  : -1..1, where the eyes look (front view only)
   *   palette: optional overrides merged over the role palette; also `hairStyle`:
   *            short | ponytail | bob | long | bun | curly
 *   swingT : optional 0..1 swing progress
   *   lite   : skip gradients and small details (low perf tier)
   */
  function draw(ctx, opts) {
    var basePal = PALETTES[opts.role] || PALETTES.player;
    var pal = opts.palette ? Object.assign({}, basePal, opts.palette) : basePal;
    var t = (opts.now || 0) / 1000;
    var state = String(opts.state || "idle");
    var side = opts.side < 0 ? -1 : 1;
    var front = opts.facing === "front";
    var running = state.indexOf("run") === 0;
    var swinging = state.indexOf("swing") === 0;
    var lean = state === "runLeft" ? -0.1 : (state === "runRight" ? 0.1 : 0);
    var cycle = running ? Math.sin(t * 15) : 0;
    var bob = running ? Math.abs(Math.cos(t * 15)) * 1.6 : Math.sin(t * 3.2) * 0.9;
    // Swing: fast ease-out sweep across the body.
    // swingT (0..1) lets the caller drive the swing; otherwise it loops on a 300 ms clock.
    var sp = swinging ? (opts.swingT != null ? Math.max(0, Math.min(1, opts.swingT)) : ((opts.now || 0) % 300) / 300) : 0;
    var sweep = swinging ? 1 - (1 - sp) * (1 - sp) : 0;

    ctx.save();
    ctx.translate(opts.x, opts.y);
    ctx.scale(opts.scale, opts.scale);

    // Ground shadow + position ring (the ring helps read reach on small screens)
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.beginPath();
    ctx.ellipse(0, 23.5, 15 - bob * 0.6, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!opts.lite) {
      ctx.strokeStyle = pal.ring;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 23.5, 19, 5.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.translate(0, -bob);
    ctx.rotate(lean);

    // ── Legs ──
    var stance = running ? 4 : 6.2;
    var lf = { x: -stance + cycle * 4.5, y: 21 - Math.max(0, cycle) * 5 + bob };
    var rf = { x: stance - cycle * 4.5, y: 21 - Math.max(0, -cycle) * 5 + bob };
    limb(ctx, -4, 6, lf.x, lf.y - 2, 5, pal.skin, [-1.5, running ? -1 : 1]);
    limb(ctx, 4, 6, rf.x, rf.y - 2, 5, pal.skin, [1.5, running ? -1 : 1]);
    shoe(ctx, lf.x, lf.y, -1, pal);
    shoe(ctx, rf.x, rf.y, 1, pal);

    // ── Off arm (behind torso) ──
    var offSwing = running ? -cycle * 4 : 0;
    limb(ctx, -side * 8.5, -9, -side * (13.5 + (swinging ? 3 : 0)), -1 + offSwing - (swinging ? 4 : 0), 4.2, pal.skin, [-side * 2, 1]);

    // ── Torso: jersey + shorts ──
    var twist = swinging ? side * (1 - sweep) * 2.2 : 0;
    roundRect(ctx, -9.5, 1.5, 19, 9, 3.5);
    ctx.fillStyle = pal.shorts;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();

    roundRect(ctx, -10 + twist, -13.5, 20, 17.5, 6.5);
    if (opts.lite) ctx.fillStyle = pal.jerseyB;
    else {
      var jg = ctx.createLinearGradient(0, -13.5, 0, 4);
      jg.addColorStop(0, pal.jerseyA);
      jg.addColorStop(1, pal.jerseyB);
      ctx.fillStyle = jg;
    }
    ctx.fill();
    ctx.stroke();

    if (!opts.lite) {
      ctx.save();
      roundRect(ctx, -10 + twist, -13.5, 20, 17.5, 6.5);
      ctx.clip();
      ctx.fillStyle = pal.trim;
      if (front) {
        // Chest stripe + V collar
        ctx.globalAlpha = 0.9;
        ctx.fillRect(-10 + twist, -5.5, 20, 2.4);
        ctx.beginPath();
        ctx.moveTo(-3.5 + twist, -13.5); ctx.lineTo(twist, -9.5); ctx.lineTo(3.5 + twist, -13.5);
        ctx.closePath();
        ctx.fillStyle = pal.skin;
        ctx.globalAlpha = 1;
        ctx.fill();
      } else {
        // Back: shoulder yoke + number bar
        ctx.globalAlpha = 0.9;
        ctx.fillRect(-10 + twist, -10.5, 20, 1.8);
        ctx.fillRect(-1.3 + twist, -6.5, 2.6, 8);
      }
      ctx.restore();
    }

    // ── Head ──
    var hy = -23 + (swinging ? 0.6 : 0);
    var hx = twist * 0.5;
    var style = String(pal.hairStyle || (front ? "short" : "ponytail"));
    var sway = running ? cycle * 2.4 : Math.sin(t * 3.2) * 0.8;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = OUTLINE;
    // Hair volume that sits behind the head (so the face stays readable in front view)
    ctx.fillStyle = pal.hair;
    if (style === "curly") {
      ctx.beginPath();
      for (var ci = 0; ci < 9; ci++) {
        var ca = Math.PI * (0.92 + ci * 0.145);
        ctx.moveTo(hx + Math.cos(ca) * 10.5 + 4.6, hy + Math.sin(ca) * 10.5);
        ctx.arc(hx + Math.cos(ca) * 10.5, hy + Math.sin(ca) * 10.5, 4.6, 0, Math.PI * 2);
      }
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, hy, 12, 0, Math.PI * 2); ctx.fill();
    } else if (style === "bun") {
      ctx.beginPath(); ctx.arc(hx, hy - 11.5, 4.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (front && (style === "bob" || style === "long")) {
      roundRect(ctx, hx - 11.6, hy - 6, 23.2, style === "long" ? 22 : 15.5, 6);
      ctx.fill(); ctx.stroke();
    } else if (front && style === "ponytail") {
      ctx.beginPath(); ctx.ellipse(hx + 10.5 + sway * 0.5, hy + 3, 3.2, 6, -0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // Neck
    ctx.fillStyle = pal.skin;
    ctx.fillRect(hx - 2.4, -15.5, 4.8, 3.5);
    ctx.beginPath();
    ctx.arc(hx, hy, 10, 0, Math.PI * 2);
    ctx.fillStyle = pal.skin;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();

    if (front) {
      // Hair cap + visor
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.arc(hx, hy, 10, Math.PI * 1.05, Math.PI * 1.95);
      ctx.quadraticCurveTo(hx, hy - 5.5, hx - 9.8, hy - 1.6);
      ctx.fill();
      ctx.fillStyle = pal.band;
      roundRect(ctx, hx - 10.6, hy - 5.2, 21.2, 3.4, 1.6);
      ctx.fill();
      ctx.stroke();
      // Eyes follow the ball
      var look = Math.max(-1, Math.min(1, Number(opts.lookX) || 0)) * 1.5;
      ctx.fillStyle = OUTLINE;
      ctx.beginPath();
      ctx.ellipse(hx - 3.6 + look, hy + 1.6, 1.25, swinging ? 0.9 : 1.7, 0, 0, Math.PI * 2);
      ctx.ellipse(hx + 3.6 + look, hy + 1.6, 1.25, swinging ? 0.9 : 1.7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Mouth: focused line, open on swing
      ctx.lineWidth = 1.1;
      ctx.lineCap = "round";
      ctx.beginPath();
      if (swinging) ctx.ellipse(hx + look * 0.5, hy + 5.6, 1.6, 1.3, 0, 0, Math.PI * 2);
      else ctx.arc(hx + look * 0.5, hy + 4.2, 2.4, 0.25 * Math.PI, 0.75 * Math.PI);
      ctx.stroke();
    } else {
      // Back of the head: hair, headband, small ponytail that lags the motion
      ctx.fillStyle = pal.hair;
      ctx.beginPath();
      ctx.arc(hx, hy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (style === "ponytail") {
        ctx.beginPath();
        ctx.ellipse(hx - sway, hy + 9.5, 3.4, 5, sway * 0.12, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      } else if (style === "bob" || style === "long") {
        roundRect(ctx, hx - 10.8 - sway * 0.2, hy - 2, 21.6, style === "long" ? 21 : 13.5, 6);
        ctx.fill(); ctx.stroke();
      } else if (style === "short") {
        // Nape of the neck shows under a short cut
        ctx.fillStyle = pal.skin;
        ctx.beginPath(); ctx.ellipse(hx, hy + 8.6, 5.2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pal.hair;
      }
      ctx.fillStyle = pal.band;
      roundRect(ctx, hx - 10.4, hy - 3.4, 20.8, 3.2, 1.5);
      ctx.fill();
      ctx.stroke();
      // Ears
      ctx.fillStyle = pal.skin;
      ctx.beginPath();
      ctx.ellipse(hx - 10, hy + 2, 1.6, 2.4, 0, 0, Math.PI * 2);
      ctx.ellipse(hx + 10, hy + 2, 1.6, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Paddle arm (in front) ──
    var sx = side * 8.5 + twist, sy = -9;
    var handX, handY, padAngle;
    if (swinging) {
      // Sweep from wide outside to across the body.
      var a = (-0.25 + sweep * 1.9);
      handX = sx + side * Math.cos(a) * 12.5;
      handY = sy - 3 - Math.sin(a) * 9 + 6 * (1 - sweep);
      padAngle = side * (1.15 - sweep * 2.1);
    } else {
      // Ready position: paddle up in front, slight idle float.
      handX = sx + side * (5.5 + (running ? cycle * 1.5 : 0));
      handY = sy + 6.5 + (running ? cycle * 2 : Math.sin(t * 3.2 + 1) * 0.6);
      padAngle = side * 0.38;
    }
    limb(ctx, sx, sy, handX, handY, 4.4, pal.skin, [side * 2.5, 2.5]);
    paddle(ctx, handX, handY, padAngle, pal);
    ctx.fillStyle = pal.skin;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(handX, handY, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Swing swoosh
    if (swinging && !opts.lite) {
      ctx.globalAlpha = 0.55 * (1 - sp);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      if (side > 0) ctx.arc(sx, sy - 4, 22 + sp * 6, -0.2, -0.2 - (0.6 + sweep * 1.5), true);
      else ctx.arc(sx, sy - 4, 22 + sp * 6, Math.PI + 0.2, Math.PI + 0.2 + (0.6 + sweep * 1.5), false);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  window.KR_CHARACTERS = { draw: draw, palettes: PALETTES };
})();
