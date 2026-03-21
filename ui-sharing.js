// ui-sharing.js - share text and share card responsibilities for Kitchen Rush

(() => {
  "use strict";

  function shareHash(score, mode, salt) {
    var d = new Date();
    var str = String(score) + "|" + String(mode) + "|" + d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() + "|" + String(salt);
    var h = 0;
    for (var i = 0; i < str.length; i += 1) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return ((h >>> 0) % 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
  }

  function install(UIModule, deps) {
    if (!UIModule || !UIModule.prototype) throw new Error("KR_UI_SHARING.install(): UI constructor missing");

    var el = deps && deps.el;
    var escapeHtml = deps && deps.escapeHtml;
    var fillTemplate = deps && deps.fillTemplate;
    var MODES = deps && deps.MODES;

    if (typeof el !== "function") throw new Error("KR_UI_SHARING.install(): el missing");
    if (typeof escapeHtml !== "function") throw new Error("KR_UI_SHARING.install(): escapeHtml missing");
    if (typeof fillTemplate !== "function") throw new Error("KR_UI_SHARING.install(): fillTemplate missing");
    if (!MODES || !MODES.RUN || !MODES.SPRINT) throw new Error("KR_UI_SHARING.install(): MODES missing");

    function todayDateParts() {
      var d = new Date();
      var monthNames = (window.KR_WORDING && window.KR_WORDING.system && window.KR_WORDING.system.monthsShort)
        ? window.KR_WORDING.system.monthsShort
        : [];
      return { month: monthNames[d.getMonth()] || "", day: d.getDate(), year: d.getFullYear() };
    }

    UIModule.prototype._generateShareCard = function () {
      var last = (this._runtime && this._runtime.lastRun) ? this._runtime.lastRun : {};
      var w = (this.wording && this.wording.share) ? this.wording.share : {};
      var appName = String(this.config?.identity?.appName || "").trim();
      var score = last.smashes || 0;
      var best = last.bestSmashes || 0;
      var isSprint = (last.mode === MODES.SPRINT);
      var isDaily = !!(last && last.isDaily === true);
      var colors = this.config?.canvas?.colors;
      if (!colors) return null;

      var salt = String(this.config?.share?.verificationSalt || "").trim();
      var hash = salt ? shareHash(score, last.mode || MODES.RUN, salt) : "";

      var cardW = 600;
      var cardH = 340;

      var canvas = document.createElement("canvas");
      canvas.width = cardW;
      canvas.height = cardH;
      var ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = colors.courtBg;
      ctx.fillRect(0, 0, cardW, cardH);

      var kitchenY = cardH * 0.65;
      ctx.fillStyle = colors.kitchenBg;
      ctx.fillRect(0, kitchenY, cardW, cardH - kitchenY);

      ctx.strokeStyle = colors.kitchenLine;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(0, kitchenY);
      ctx.lineTo(cardW, kitchenY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(appName, cardW / 2, 24);

      var modeLabel = "";
      if (isDaily) {
        modeLabel = String(w.cardDailyLabel || "").trim();
        var dp = todayDateParts();
        var dateFmt = String(w.cardDateFormat || "").trim();
        if (dateFmt && modeLabel) {
          modeLabel += " — " + fillTemplate(dateFmt, dp);
        }
      } else if (isSprint) {
        modeLabel = String(w.cardSprintLabel || "").trim();
      }
      if (modeLabel) {
        ctx.font = "16px system-ui, -apple-system, sans-serif";
        ctx.globalAlpha = 0.7;
        ctx.fillText(modeLabel, cardW / 2, 56);
        ctx.globalAlpha = 1;
      }

      ctx.font = "bold 96px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(String(score), cardW / 2, cardH * 0.42);

      var smashLabel = String(w.cardSmashesLabel || "").trim();
      if (smashLabel) {
        ctx.font = "20px system-ui, -apple-system, sans-serif";
        ctx.globalAlpha = 0.8;
        ctx.fillText(smashLabel, cardW / 2, cardH * 0.58);
        ctx.globalAlpha = 1;
      }

      if (best > 0 && !isSprint) {
        var bestLabel = String(w.cardBestLabel || "").trim();
        if (bestLabel) {
          ctx.font = "16px system-ui, -apple-system, sans-serif";
          ctx.globalAlpha = 0.6;
          ctx.fillText(fillTemplate(bestLabel, { best: best }), cardW / 2, cardH * 0.68);
          ctx.globalAlpha = 1;
        }
      }

      if (hash) {
        ctx.font = "11px monospace";
        ctx.textAlign = "right";
        ctx.globalAlpha = 0.35;
        ctx.fillText("#" + hash, cardW - 12, cardH - 10);
        ctx.globalAlpha = 1;
        ctx.textAlign = "center";
      }

      var tagline = String(w.cardTagline || "").trim();
      if (tagline) {
        ctx.font = "14px system-ui, -apple-system, sans-serif";
        ctx.globalAlpha = 0.5;
        ctx.fillText(tagline, cardW / 2, cardH - 20);
        ctx.globalAlpha = 1;
      }

      return canvas;
    };

    UIModule.prototype._getShareText = function () {
      var w = (this.wording && this.wording.share) ? this.wording.share : {};
      var last = (this._runtime && this._runtime.lastRun) ? this._runtime.lastRun : {};
      var url = String(this.config?.identity?.appUrl || "").trim();
      var isDaily = !!(last && last.isDaily === true);

      var hashtagPrefix = String(w.hashtagPrefix || "").trim();
      var hashtag = hashtagPrefix ? hashtagPrefix + (last.smashes || 0) : "";

      var dp = todayDateParts();
      var dateStr = dp.month + " " + dp.day;

      var modLabel = "";
      var modDesc = "";
      var objMet = false;
      if (last.dailyModifier) {
        modLabel = last.dailyModifier.label || "";
        modDesc = last.dailyModifier.desc || "";
      }
      if (last.dailyObjectiveMet) objMet = true;
      var modLine = modLabel ? (modLabel + (objMet ? " ✅" : " ❌")) : "";

      var tpl = "";
      if (isDaily) tpl = w.templateDaily || w.templateDefault || "";
      else if (last.mode === MODES.SPRINT) tpl = w.templateSprint || "";
      else if (last.newBest) tpl = w.templateNewBest || "";
      else if (last.totalFaulted > 0) tpl = w.templateFault || "";
      else tpl = w.templateDefault || "";

      var raw = fillTemplate(tpl, {
        score: last.smashes || 0,
        best: last.bestSmashes || 0,
        url: url,
        hashtag: hashtag,
        date: dateStr,
        modifier: modLine,
        modifierName: modLabel,
        modifierDesc: modDesc,
        objective: objMet ? "✅" : "❌",
        streak: last.bestStreak || 0
      });
      return raw.split("\n").map(function (l) { return l.trimEnd(); }).join("\n");
    };

    UIModule.prototype.copyShareText = async function () {
      var text = this._getShareText();
      if (!text) return;
      this._store("markShareClicked");

      var card = this._generateShareCard();
      if (card && navigator.share && navigator.canShare) {
        try {
          var blob = await new Promise(function (resolve) { card.toBlob(resolve, "image/png"); });
          if (blob) {
            var file = new File([blob], "kitchen-rush-score.png", { type: "image/png" });
            var shareData = { text: text, files: [file] };
            if (navigator.canShare(shareData)) {
              await navigator.share(shareData);
              return;
            }
          }
        } catch (e) {
          if (e && e.name === "AbortError") return;
        }
      }

      if (navigator.share) {
        try { await navigator.share({ text: text }); return; } catch (_) { }
      }

      try { await navigator.clipboard.writeText(text); }
      catch (_) {
        try {
          var ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        } catch (_) { return; }
      }

      var msg = String(this.wording?.share?.toastCopied || "").trim();
      if (msg) this._toastNow(this.config, msg, { timingKey: "positive" });
    };

    UIModule.prototype.sendShareViaEmail = function () {
      var text = this._getShareText();
      if (!text) return;
      this._store("markShareClicked");
      var subject = String(this.config?.identity?.appName || "").trim();
      var url = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
      try { window.open(url, "_self"); } catch (_) { }
    };

    UIModule.prototype._showShareCardModal = function () {
      if (this.state !== window.KR_ENUMS.UI_STATES.END) return;
      var card = this._generateShareCard();
      if (!card) return;

      var sw = (this.wording && this.wording.share) ? this.wording.share : {};
      var shareTitle = String(sw.cardModalTitle || "").trim();
      var shareCta = String(sw.ctaLabel || "").trim();

      var dataUrl = "";
      try { dataUrl = card.toDataURL("image/png"); } catch (_) { return; }

      var html = '<div class="kr-share-card-modal">';
      if (shareTitle) html += '<p class="kr-share-card-title">' + escapeHtml(shareTitle) + '</p>';
      html += '<img src="' + dataUrl + '" class="kr-share-card-img" alt="Score card" />';
      html += '<div class="kr-actions">';
      if (shareCta) html += '<button id="kr-share-card-btn" class="kr-btn kr-btn--primary">' + escapeHtml(shareCta) + '</button>';
      html += '</div></div>';

      this.openModal(html);

      var self = this;
      var btn = el("kr-share-card-btn");
      if (btn) btn.addEventListener("click", function () {
        self.closeModal();
        self.copyShareText();
      });
    };
  }

  window.KR_UI_SHARING = { install: install };
})();
