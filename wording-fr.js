// wording-fr.js - French overrides for the app copy (everything except Duel, which has wording.duelFr).
// Loaded right after wording.js. The language is the saved choice (localStorage "kr:lang"), else the browser's.
// Rules: keep every {placeholder} exactly as in wording.js (tests/wording.test.mjs checks it), and only
// override keys that exist in the English base (the same test checks that too).

(() => {
  "use strict";

  function pickLang() {
    // ?lang=fr / ?lang=en gives each language its own shareable address; it is remembered for next time.
    var q = "";
    try { q = String(new URLSearchParams(window.location.search).get("lang") || "").toLowerCase(); } catch (_) { }
    if (q === "fr" || q === "en") { try { window.localStorage.setItem("kr:lang", q); } catch (_) { } return q; }
    // An entry page (fr.html) declares its language; it beats the saved choice so French links always open in French.
    try { var meta = document.querySelector('meta[name="kr-lang"]'); var ml = meta && String(meta.getAttribute("content") || ""); if (ml === "fr" || ml === "en") return ml; } catch (_) { }
    var stored = "";
    try { stored = String(window.localStorage.getItem("kr:lang") || ""); } catch (_) { }
    if (stored === "fr" || stored === "en") return stored;
    var nav = "";
    try { nav = String((window.navigator && window.navigator.language) || ""); } catch (_) { }
    return /^fr/i.test(nav) ? "fr" : "en";
  }

  function merge(base, over) {
    Object.keys(over).forEach(function (k) {
      var v = over[k];
      if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object") merge(base[k], v);
      else base[k] = v;
    });
    return base;
  }

  var FR = {
    footer: {
      contact: "Contact",
      privacy: "Confidentialité",
      terms: "Conditions"
    },
    system: {
      close: "Fermer",
      skipToContent: "Aller au contenu principal",
      home: "Accueil",
      monthsShort: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
      updateAvailable: "Mise à jour disponible.",
      dismiss: "Ignorer",
      offlinePayment: "Le paiement nécessite une connexion internet.",
      copied: "Copié",
      copyFailed: "Copie impossible",
      openFailed: "Impossible d'ouvrir cette action.",
      emailOpenFailed: "Impossible d'ouvrir votre application de messagerie.",
      more: "Comment jouer",
      notNow: "Plus tard",
      playAria: "Commencer une nouvelle partie",
      shareAria: "Partager votre score",
      scoreAria: "Score",
      endActionsAria: "Actions de fin de partie",
      premiumUnlockedToast: "Premium débloqué",
      downloaded: "Téléchargé",
      storageSaveFailedToast: "La sauvegarde est désactivée dans ce mode de navigation. Votre progression peut être perdue si vous actualisez.",
      loadingLabel: "Chargement...",
      reloadCta: "Recharger",
      fatalGeneric: "Impossible de charger le jeu. Actualisez la page.",
      fatalModules: "Impossible de charger les composants du jeu. Actualisez la page.",
      fatalConfig: "Erreur de configuration : réglages de l'application non chargés.",
      fatalWording: "Erreur de configuration : textes de l'interface non chargés.",
      fatalStorage: "Votre navigateur ne gère pas le stockage local. Utilisez un navigateur récent.",
      fatalContainer: "Erreur critique : conteneur de l'application introuvable.",
      fatalPromise: "Un problème inattendu est survenu. Actualisez la page."
    },
    landing: {
      tagline: "L'arcade du pickleball.",
      subtitle: "Visez vos coups, maîtrisez la cuisine, grimpez l'échelle.",
      ctaDuel: "Jouer un match",
      duelExplain: "Choisissez votre joueur et votre terrain, puis renvoyez la balle pour battre six adversaires.",
      arcadeLabel: "Modes arcade",
      dailyBadge: "Défi du jour",
      dailyExplain: "Un défi partagé chaque jour.",
      classicUnlockHint: "Le Classique est toujours disponible.",
      ctaPlayDaily: "Jouer le défi du jour",
      ctaPlay: "Jouer en Classique",
      ctaPlayAfterFirstRun: "Rejouer",
      bestLabel: "Record",
      bestAriaTemplate: "Record personnel : {best} frappes",
      bestTargetTemplate: "Pouvez-vous atteindre {target} ?",
      premiumLabel: "Parties illimitées sur cet appareil",
      powerTease: "Les parties longues débloquent des pouvoirs.",
      nextPowerLabel: "Prochain pouvoir",
      nextPowerTemplate: "{power} à {score} frappes",
      weeklyPowerLabel: "Cette semaine",
      weeklyPowerTemplate: "{power} à l'honneur",
      runsLabel: "Parties",
      lifetimeTemplate: "{total} frappes au total",
      postPaywallTitle: "Vos parties gratuites sont épuisées.",
      postPaywallBody: "Débloquez les parties illimitées et continuez à découvrir de nouveaux pouvoirs.",
      postPaywallCta: "Voir les options",
      postPaywallSbTitle: "Avant de décider...",
      postPaywallSbBody: "Un mode secret vous attend. Cherchez la balle de pouvoir."
    },
    ui: {
      livesLabel: "Vies",
      livesAria: "{lives} vies restantes",
      scoreAriaTemplate: "Score : {score} frappes",
      sprintTimerAriaTemplate: "Temps restant : {remaining} secondes",
      gameOverTitle: "Partie terminée",
      kitchenLabel: "CUISINE",
      comboLabel: "SÉRIE",
      kitchenOpenLabel: "CUISINE LIBRE",
      waitLabel: "ATTENDEZ",
      nowLabel: "MAINTENANT !",
      goLabel: "GO !",
      serveLabel: "SERVICE",
      doubleBounceLabel: "LAISSEZ REBONDIR",
      returnBounceLabel: "2E REBOND",
      specialBallPrefix: "PWR",
      specialBallDink: "AMORTI",
      specialBallLob: "LOB",
      specialBallFast: "RAPIDE",
      specialBallSkid: "GLISSÉ",
      specialBallHeavy: "LOURDE",
      powerUpExtraLife: "VIE EN PLUS",
      powerUpShield: "BOUCLIER",
      powerUpSpeedBoost: "VITESSE",
      powerUpPerfectWindow: "FOCUS",
      powerUpSmashBoost: "SMASH x2",
      powerUpWeeklyPrefix: "SEMAINE",
      powerUpReadyPrefix: "POUVOIR",
      powerUpActivePrefix: "ACTIF",
      powerUpSavedByShield: "BOUCLIER",
      powerUpRevealHint: "Les parties longues débloquent des pouvoirs plus forts.",
      hitLabel: "FRAPPE",
      controlMoveLabel: "BOUGER",
      controlTimingLabel: "TIMING",
      timingPerfectLabel: "PARFAIT !",
      timingNiceLabel: "BIEN !",
      startOverlayTouchLeftKey: "Moitié gauche",
      startOverlayTouchRightKey: "Moitié droite",
      startOverlayMouseKey: "Souris",
      startOverlayKeyboardKey: "←↑→↓",
      startOverlayClickKey: "Clic / Espace",
      startOverlayMoveTouch: "Glissez pour bouger",
      startOverlayHitTouch: "Touchez au bon moment",
      startOverlayMoveMouse: "Bougez sur le terrain",
      startOverlayMoveKeys: "Bougez avec les flèches",
      startOverlayHitDesktop: "Frappez au bon moment",
      startOverlayAutoReturnHint: "Approchez-vous pour un renvoi automatique. Le bon timing double les points.",
      startOverlayKitchenHint: "Balle en cuisine : laissez rebondir",
      startOverlayPowerHint: "Les parties longues débloquent des balles de pouvoir et des bonus.",
      startOverlayTapToStart: "Touchez pour commencer",
      dailyObjectiveMet: "Objectif du jour atteint !",
      startRunTypeFree: "PARTIE GRATUITE",
      startRunTypeLastFree: "Dernière partie gratuite.",
      startRunRemainingTemplate: "{remaining}/{limit} parties gratuites restantes",
      lastLifeOverlay: "Dernière vie.",
      gameOverOverlay: "Partie terminée."
    },
    end: {
      title: "Partie terminée",
      scoreLine: "{score} frappes",
      personalBestLine: "Record personnel : {best}",
      bestStreakLine: "Meilleur échange : {streak}",
      newBest: "Nouveau record personnel !",
      almostBest: "Plus que {gap} pour votre record.",
      debriefAccuracy: "{accuracy} % de réussite",
      debriefFaults: "{faults} fautes en cuisine",
      debriefMisses: "{misses} manquées",
      debriefDuration: "{seconds} s sur le terrain",
      freeRunLeft: "{remaining} partie gratuite restante.",
      playAgain: "Rejouer",
      playAgainNearBest: "Si près — encore une",
      playAgainAfterBest: "Défendez votre record",
      nextRunLabel: "Prochaine partie :",
      nextRunBestGap: "+{gap} pour battre votre record",
      nextRunHoldCleaner: "restez aussi propre",
      nextRunHoldAccuracy: "gardez ce timing",
      nextRunHoldStreak: "battez l'échange {target}",
      nextRunFewerFaults: "1 faute de cuisine en moins",
      nextRunAccuracy: "attendez un temps de plus",
      nextRunStreak: "visez l'échange {target}",
      nextPowerLabel: "À découvrir :",
      nextPowerTemplate: "{power} à {score} frappes",
      weeklyPowerLabel: "Cette semaine :",
      weeklyPowerTemplate: "{power} à l'honneur",
      shareTitle: "Partager"
    },
    firstRun: {
      trustLine: "Pas de pub. Pas de piège. Juste le terrain.",
      kitchenHint: "Balle en cuisine ? Laissez-la rebondir, puis frappez.",
      powerHint: "Tenez assez longtemps et de nouveaux pouvoirs apparaissent.",
      rule1: "Placez-vous à portée",
      rule2: "Touchez, cliquez ou appuyez sur Espace pour frapper",
      rule3: "Le service et le retour doivent d'abord rebondir"
    },
    howto: {
      title: "Comment jouer",
      line1: "Les balles tombent sur le terrain.",
      line2: "Le service et le retour doivent rebondir une fois.",
      line3: "Balle en cuisine ? Attendez le rebond.",
      ruleTitle: "La règle de la cuisine",
      ruleSentence: "La cuisine est la zone sans volée près du filet. Frappez trop tôt et vous perdez une vie.",
      premiumTitle: "Premium",
      alreadyPremium: "Premium est déjà actif.",
      activateTitle: "Activer avec un code",
      activateLine1: "Un code premium ? Activez-le ici.",
      activateLine2: "Aucun compte nécessaire. Votre code reste sur cet appareil.",
      activationCodeLabel: "Code d'activation",
      enterCode: "Saisissez un code.",
      codeRejected: "Code refusé.",
      activateCta: "Activer",
      codeInvalid: "Format de code invalide.",
      codeUsed: "Cet appareil a déjà utilisé un code.",
      codeOk: "Premium activé sur cet appareil.",
      autoActivateTitle: "Code premium prêt",
      autoActivateLine1: "Votre code premium est déjà enregistré.",
      autoActivateLine2: "Activer Premium maintenant ?",
      autoActivateCta: "Activer maintenant",
      autoActivateLater: "Plus tard"
    }
  };

  var lang = pickLang();
  window.KR_LANG = lang;
  window.KR_WORDING_FR = FR;
  window.KR_I18N = { merge: merge, pickLang: pickLang };
  try { if (document && document.documentElement) document.documentElement.lang = lang; } catch (_) { }
  if (lang === "fr" && window.KR_WORDING) merge(window.KR_WORDING, FR);
})();
