// share-card.js - shareable result picture for the Daily Duel: a 1080x1350 image drawn on a canvas,
// shared as a file when the browser can (Web Share with files), otherwise downloaded. Idea taken from the
// Pickleball Rules Quiz score card. Drawing only uses basic 2D calls so tests can run it on a recording stub.

(() => {
  "use strict";

  var W = 1080, H = 1350;
  var COPY = {
    en: { title: "KITCHEN RUSH", sub: "Daily Duel", vs: "vs {name}", cta: "Can you beat me?", file: "kitchen-rush-daily.png" },
    fr: { title: "KITCHEN RUSH", sub: "Duel du jour", vs: "contre {name}", cta: "Tu fais mieux ?", file: "kitchen-rush-duel-du-jour.png" }
  };

  function copyFor(lang) { return COPY[lang === "fr" ? "fr" : "en"]; }
  function int(v) { var n = Math.floor(Number(v)); return isFinite(n) && n >= 0 ? Math.min(n, 99) : 0; }

  // Draws the card on any 2D context. o = { lang, you, them, name, date, urlText }
  function draw(ctx, o) {
    o = o || {};
    var c = copyFor(o.lang), you = int(o.you), them = int(o.them), won = you > them;

    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a1030"); bg.addColorStop(0.6, "#070b1f"); bg.addColorStop(1, "#0b1a2e");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    [[140, 40, "88,160,255"], [940, 40, "255,120,90"]].forEach(function (g) {
      var rg = ctx.createRadialGradient(g[0], g[1], 0, g[0], g[1], 620);
      rg.addColorStop(0, "rgba(" + g[2] + ",0.40)"); rg.addColorStop(1, "rgba(" + g[2] + ",0)");
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    });

    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff"; ctx.font = "italic 800 124px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(c.title, W / 2, 170);
    ctx.fillStyle = "#a8b4d8"; ctx.font = "600 44px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(c.sub + (o.date ? " · " + String(o.date).slice(0, 10) : ""), W / 2, 238);

    // Court in perspective: far baseline at the top, kitchen bands around the net
    function poly(pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    poly([[330, 300], [750, 300], [930, 770], [150, 770]], "#2f6fed");
    poly([[296, 410], [784, 410], [800, 450], [280, 450]], "#ff7a45");
    poly([[300, 440], [780, 440], [830, 560], [250, 560]], "#ff8d5c");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(264, 556, 552, 8);
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(538, 300, 4, 470);

    ctx.fillStyle = "#e8ecff"; ctx.font = "700 56px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(c.vs.replace("{name}", String(o.name || "").slice(0, 24)), W / 2, 860);

    ctx.fillStyle = won ? "#3ce68c" : "#ffffff"; ctx.font = "800 250px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(you + " – " + them, W / 2, 1080);

    ctx.fillStyle = "#ffcc5c"; ctx.font = "800 66px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(c.cta, W / 2, 1180);
    ctx.fillStyle = "#a8b4d8"; ctx.font = "600 42px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(String(o.urlText || "").slice(0, 60), W / 2, 1260);
  }

  function render(o) {
    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;
    draw(ctx, o);
    return canvas;
  }

  function toBlob(o) {
    return new Promise(function (resolve) {
      var canvas = render(o);
      if (!canvas || !canvas.toBlob) { resolve(null); return; }
      canvas.toBlob(function (b) { resolve(b || null); }, "image/png");
    });
  }

  // Resolves "shared", "cancelled" (the player closed the share sheet) or "unsupported" (caller falls back to text).
  function share(o, text) {
    return toBlob(o).then(function (blob) {
      if (!blob || typeof File !== "function" || !navigator.canShare || !navigator.share) return "unsupported";
      var file = new File([blob], copyFor(o && o.lang).file, { type: "image/png" });
      if (!navigator.canShare({ files: [file] })) return "unsupported";
      return navigator.share({ files: [file], text: text || "" }).then(function () { return "shared"; }, function (e) {
        return (e && e.name === "AbortError") ? "cancelled" : "unsupported";
      });
    }, function () { return "unsupported"; });
  }

  function download(o) {
    return toBlob(o).then(function (blob) {
      if (!blob) return false;
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = copyFor(o && o.lang).file; a.hidden = true;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) { } }, 1000);
      return true;
    });
  }

  window.KR_CARD = { W: W, H: H, draw: draw, render: render, share: share, download: download };
})();
