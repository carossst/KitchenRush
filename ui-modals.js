// ui-modals.js - non-gameplay modal responsibilities for Kitchen Rush

(() => {
  "use strict";

  function warn(message, error) {
    try {
      console.warn("[KR Modals]", message, error || "");
    } catch (_) { }
  }

  function install(UIModule, deps) {
    if (!UIModule || !UIModule.prototype) throw new Error("KR_UI_MODALS.install(): UI constructor missing");

    var el = deps && deps.el;
    var escapeHtml = deps && deps.escapeHtml;
    var toastNow = deps && deps.toastNow;
    var fillTemplate = deps && deps.fillTemplate;
    var requiredConfigNumber = deps && deps.requiredConfigNumber;
    var getEmailApi = deps && deps.getEmailApi;

    if (typeof el !== "function") throw new Error("KR_UI_MODALS.install(): el missing");
    if (typeof escapeHtml !== "function") throw new Error("KR_UI_MODALS.install(): escapeHtml missing");
    if (typeof toastNow !== "function") throw new Error("KR_UI_MODALS.install(): toastNow missing");
    if (typeof fillTemplate !== "function") throw new Error("KR_UI_MODALS.install(): fillTemplate missing");
    if (typeof requiredConfigNumber !== "function") throw new Error("KR_UI_MODALS.install(): requiredConfigNumber missing");
    if (typeof getEmailApi !== "function") throw new Error("KR_UI_MODALS.install(): getEmailApi missing");

    UIModule.prototype.openModal = function (html) {
      var overlay = el("kr-modal-overlay");
      var content = el("kr-modal-content");
      if (!overlay || !content) return;
      content.innerHTML = html;
      overlay.classList.add("kr-modal--visible");
      overlay.setAttribute("aria-hidden", "false");

      var focusable = content.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (focusable.length) focusable[0].focus();

      var self = this;
      overlay.addEventListener("click", function (e) { if (e.target === overlay) self.closeModal(); }, { once: true });
    };

    UIModule.prototype.closeModal = function () {
      var overlay = el("kr-modal-overlay");
      if (overlay) {
        overlay.classList.remove("kr-modal--visible");
        overlay.setAttribute("aria-hidden", "true");
      }
    };

    UIModule.prototype.openHowToModal = function () {
      var w = this.wording?.howto || {};
      var premium = !!(this._store("isPremium"));

      var h = '<h2 class="kr-h2">' + escapeHtml(w.title || "") + '</h2>';
      h += '<p>' + escapeHtml(w.line1 || "") + '</p>';
      h += '<p>' + escapeHtml(w.line2 || "") + '</p>';
      h += '<p>' + escapeHtml(w.line3 || "") + '</p>';
      if (w.ruleTitle) h += '<h3 class="kr-h3">' + escapeHtml(w.ruleTitle || "") + '</h3>';
      if (w.ruleSentence) h += '<p class="kr-muted">' + escapeHtml(w.ruleSentence || "") + '</p>';

      if (!premium) {
        h += '<div class="kr-divider"></div>';
        h += '<h3 class="kr-h3">' + escapeHtml(w.premiumTitle || "") + '</h3>';
        h += '<h4>' + escapeHtml(w.activateTitle || "") + '</h4>';
        h += '<div class="kr-redeem-inline">';
        h += '<input id="kr-howto-code" type="text" class="kr-input" placeholder="' + escapeHtml(w.activationCodePlaceholder || "") + '" maxlength="16" autocomplete="off" />';
        h += '<button id="kr-howto-redeem" class="kr-btn kr-btn--secondary">' + escapeHtml(w.redeemCta || "") + '</button>';
        h += '</div>';
      }
      h += '<div class="kr-actions"><button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(this.wording?.system?.close || "") + '</button></div>';

      this.openModal(h);

      var self = this;
      var redeemBtn = el("kr-howto-redeem");
      if (redeemBtn) {
        redeemBtn.addEventListener("click", function () {
          var input = el("kr-howto-code");
          if (input) self._redeemCode(String(input.value || "").trim());
        });
      }
    };

    UIModule.prototype.openRedeemModal = function () {
      var w = this.wording?.howto || {};
      var h = '<h2 class="kr-h2">' + escapeHtml(w.activateTitle || "") + '</h2>';
      h += '<div class="kr-redeem-inline">';
      h += '<input id="kr-redeem-code" type="text" class="kr-input" placeholder="' + escapeHtml(w.activationCodePlaceholder || "") + '" maxlength="16" autocomplete="off" />';
      h += '<button id="kr-redeem-confirm" class="kr-btn kr-btn--primary">' + escapeHtml(w.redeemCta || "") + '</button>';
      h += '</div>';
      h += '<div class="kr-actions"><button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(this.wording?.system?.close || "") + '</button></div>';
      this.openModal(h);

      var self = this;
      var btn = el("kr-redeem-confirm");
      if (btn) {
        btn.addEventListener("click", function () {
          var input = el("kr-redeem-code");
          if (input) self._redeemCode(String(input.value || "").trim());
        });
      }
    };

    UIModule.prototype.openAutoRedeemModal = function () {
      var code = String(this._store("getVanityCode") || "").trim();
      if (!code) return;

      var w = this.wording?.howto || {};
      var h = '<h2 class="kr-h2">' + escapeHtml(w.autoActivateTitle || w.activateTitle || "") + '</h2>';
      h += '<p>' + escapeHtml(w.autoActivateBody || "") + '</p>';
      h += '<div class="kr-redeem-inline">';
      h += '<input id="kr-redeem-code" type="text" class="kr-input" value="' + escapeHtml(code) + '" readonly />';
      h += '<button id="kr-redeem-confirm" class="kr-btn kr-btn--primary">' + escapeHtml(w.redeemCta || "") + '</button>';
      h += '</div>';
      h += '<div class="kr-actions"><button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(this.wording?.system?.close || "") + '</button></div>';
      this.openModal(h);

      var self = this;
      var btn = el("kr-redeem-confirm");
      if (btn) btn.addEventListener("click", function () { self._redeemCode(code); });
    };

    UIModule.prototype.openSupportModal = function () {
      var w = this.wording?.support || {};
      var emailApi = getEmailApi();
      if (!this._runtime.supportEmail) {
        try {
          if (emailApi && typeof emailApi.getSupportEmailDecoded === "function") {
            this._runtime.supportEmail = emailApi.getSupportEmailDecoded() || "";
          }
        } catch (error) {
          warn("support email decode failed", error);
        }
      }
      if (!this._runtime.supportEmail) return;

      var h = '<h2 class="kr-h2">' + escapeHtml(w.modalTitle || "") + '</h2>';
      h += '<p>' + escapeHtml(w.modalBodyLine1 || "") + '</p>';
      h += '<div class="kr-actions kr-actions--stack">';
      h += '<button data-action="open-support-email" class="kr-btn kr-btn--primary">' + escapeHtml(w.ctaOpen || "") + '</button>';
      h += '<button data-action="copy-support-email" class="kr-btn kr-btn--secondary">' + escapeHtml(w.ctaCopy || "") + '</button>';
      h += '<button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(this.wording?.system?.close || "") + '</button>';
      h += '</div>';
      this.openModal(h);
    };

    UIModule.prototype._showSprintWelcomeModal = function () {
      var w = this.wording?.sprint || {};
      var h = '<h2 class="kr-h2">' + escapeHtml(w.modalTitle || "") + '</h2>';
      h += '<p>' + escapeHtml(w.modalBody || "") + '</p>';
      h += '<div class="kr-actions"><button id="kr-sprint-modal-cta" class="kr-btn kr-btn--primary">' + escapeHtml(w.modalCta || "") + '</button></div>';
      this.openModal(h);

      var self = this;
      var cta = el("kr-sprint-modal-cta");
      if (cta) {
        cta.addEventListener("click", function () {
          self.closeModal();
          window.dispatchEvent(new CustomEvent("kr-sprint-requested"));
        });
      }
    };

    UIModule.prototype._showSprintFreeLimitReached = function () {
      var w = this.wording?.sprint || {};
      var limit = requiredConfigNumber(this.config?.sprint?.freeRunsLimit, "KR_CONFIG.sprint.freeRunsLimit", { min: 0, integer: true });
      var h = '<h2 class="kr-h2">' + escapeHtml(w.freeLimitReachedTitle || "") + '</h2>';
      h += '<p>' + escapeHtml(fillTemplate(w.freeLimitReachedBody || "", { limit: limit })) + '</p>';
      h += '<div class="kr-actions kr-actions--stack">';
      h += '<button data-action="show-paywall" class="kr-btn kr-btn--primary">' + escapeHtml(w.freeLimitReachedCta || "") + '</button>';
      h += '<button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(w.freeLimitReachedClose || "") + '</button>';
      h += '</div>';
      this.openModal(h);
    };

    UIModule.prototype.openWaitlistModal = function () {
      var emailApi = getEmailApi();
      if (!emailApi || typeof emailApi.buildMailto !== "function") return;
      if (!emailApi.buildMailto(this.config, "")) return;

      var w = this.wording?.waitlist || {};
      var h = '<h2 class="kr-h2">' + escapeHtml(w.title || "") + '</h2>';
      h += '<p>' + escapeHtml(w.bodyLine1 || "") + '</p>';
      h += '<textarea id="kr-waitlist-idea" class="kr-input" rows="3" placeholder="' + escapeHtml(w.inputPlaceholder || "") + '"></textarea>';
      h += '<div class="kr-actions kr-actions--stack">';
      h += '<button id="kr-waitlist-send" class="kr-btn kr-btn--primary">' + escapeHtml(w.cta || "") + '</button>';
      h += '<button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(this.wording?.system?.close || "") + '</button>';
      h += '</div>';
      this.openModal(h);

      var ta = el("kr-waitlist-idea");
      if (ta) {
        var draft = this._store("getWaitlistDraftIdea") || "";
        if (draft) ta.value = draft;
        var self = this;
        ta.addEventListener("input", function () {
          if (self.storage && typeof self.storage.setWaitlistDraftIdea === "function") self.storage.setWaitlistDraftIdea(ta.value);
        });
      }

      var sendBtn = el("kr-waitlist-send");
      var self2 = this;
      if (sendBtn) sendBtn.addEventListener("click", function () { self2.sendWaitlistViaEmail(); });
    };

    UIModule.prototype.sendWaitlistViaEmail = function () {
      var idea = (el("kr-waitlist-idea") || {}).value || "";
      var mailto = "";
      var emailApi = getEmailApi();
      if (emailApi && typeof emailApi.buildMailto === "function") {
        mailto = emailApi.buildMailto(this.config, idea);
      }
      if (!mailto) return;
      try { window.open(mailto, "_self"); } catch (error) { warn("waitlist mailto open failed", error); return; }
      this._store("setWaitlistStatus", "joined");
      this.closeModal();
    };

    UIModule.prototype.openStatsSharingModal = function () {
      var w = this.wording?.statsSharing || {};
      var payload = this._store("getAnonymousStatsPayload") || null;
      if (!payload) return;

      var preview = JSON.stringify(payload, null, 2);
      var h = '<h2 class="kr-h2">' + escapeHtml(w.modalTitle || "") + '</h2>';
      h += '<p class="kr-muted">' + escapeHtml(w.modalDescription || "") + '</p>';
      h += '<pre class="kr-stats-preview">' + escapeHtml(preview) + '</pre>';
      h += '<div class="kr-actions kr-actions--stack">';
      h += '<button id="kr-stats-send" class="kr-btn kr-btn--primary">' + escapeHtml(w.ctaSend || "") + '</button>';
      h += '<button id="kr-stats-copy" class="kr-btn kr-btn--secondary">' + escapeHtml(w.ctaCopy || "") + '</button>';
      h += '<button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(this.wording?.system?.close || "") + '</button>';
      h += '</div>';
      this.openModal(h);

      var self = this;
      var sendBtn = el("kr-stats-send");
      if (sendBtn) sendBtn.addEventListener("click", function () { self.sendStatsViaEmail(); });
      var copyBtn = el("kr-stats-copy");
      if (copyBtn) copyBtn.addEventListener("click", function () { self.copyStatsToClipboard(); });
    };

    UIModule.prototype.sendStatsViaEmail = function () {
      var payload = this._store("getAnonymousStatsPayload") || null;
      if (!payload) return;

      var subject = String(this.config?.statsSharing?.emailSubject || "").trim();
      var body = JSON.stringify(payload, null, 2);
      var emailApi = getEmailApi();
      var email = (emailApi && typeof emailApi.getSupportEmailDecoded === "function") ? emailApi.getSupportEmailDecoded() : "";
      if (!email) return;

      var q = [];
      if (subject) q.push("subject=" + encodeURIComponent(subject));
      if (body) q.push("body=" + encodeURIComponent(body));
      try { window.open("mailto:" + email + (q.length ? "?" + q.join("&") : ""), "_self"); } catch (error) { warn("stats mailto open failed", error); return; }

      var msg = String(this.wording?.statsSharing?.successToast || "").trim();
      if (msg) toastNow(this.config, msg, { timingKey: "positive" });
      this.closeModal();
    };

    UIModule.prototype.copyStatsToClipboard = async function () {
      var payload = this._store("getAnonymousStatsPayload") || null;
      if (!payload) return;
      try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); } catch (error) { warn("stats clipboard copy failed", error); return; }
      var msg = String(this.wording?.statsSharing?.copyToast || "").trim();
      if (msg) toastNow(this.config, msg, { timingKey: "positive" });
    };

    UIModule.prototype._maybePromptStatsSharingMilestone = function () {
      var cfg = this.config?.statsSharing;
      if (!cfg || !cfg.enabled) return;

      var rc = ((this._store("getCounters") || {}).runCompletes || 0);
      var milestones = cfg.promptAfterRunCompletes || [];

      var shouldPrompt = false;
      for (var i = 0; i < milestones.length; i += 1) {
        if (rc === milestones[i]) {
          shouldPrompt = true;
          break;
        }
      }

      if (!shouldPrompt && cfg.promptOnFreeRunsExhausted) {
        var balance = this._store("getRunsBalance") || 0;
        var premium = !!(this._store("isPremium"));
        if (balance <= 0 && !premium) shouldPrompt = true;
      }

      var snooze = this.storage ? (this.storage.getStatsSharingSnoozeUntilRunCompletes() || 0) : 0;
      if (rc < snooze) shouldPrompt = false;
      if (!shouldPrompt) return;

      var w = this.wording?.statsSharing || {};
      var body = fillTemplate(w.promptBodyTemplate || "", { runCompletes: rc });
      var h = '<h2 class="kr-h2">' + escapeHtml(w.promptTitle || "") + '</h2>';
      h += '<p>' + escapeHtml(body) + '</p>';
      h += '<div class="kr-actions kr-actions--stack">';
      h += '<button id="kr-stats-prompt-yes" class="kr-btn kr-btn--primary">' + escapeHtml(w.promptCtaPrimary || "") + '</button>';
      h += '<button id="kr-stats-prompt-no" class="kr-btn kr-btn--secondary">' + escapeHtml(w.promptCtaSecondary || "") + '</button>';
      h += '</div>';
      this.openModal(h);

      var self = this;
      var yesBtn = el("kr-stats-prompt-yes");
      if (yesBtn) yesBtn.addEventListener("click", function () { self.closeModal(); self.openStatsSharingModal(); });
      var noBtn = el("kr-stats-prompt-no");
      if (noBtn) {
        noBtn.addEventListener("click", function () {
          if (self.storage && typeof self.storage.snoozeStatsSharingPromptNextEnd === "function") self.storage.snoozeStatsSharingPromptNextEnd();
          self.closeModal();
        });
      }
    };
  }

  window.KR_UI_MODALS = { install: install };
})();
