// config.js v29.0 - Kitchen Rush
// Configuration + UI copy (single file, no split)
// Kitchen Rush

(() => {
  "use strict";

  // ============================================
  // Environment detection
  // ============================================
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isGitHubPages = hostname.includes("github.io");

  // Single source of truth for storage-related keys (avoid drift)
  const KR_STORAGE_KEY = "kitchen_rush_v1";
  const KR_VANITY_CODE_STORAGE_KEY = "kr:vanityCode";


  // ============================================
  // Global UI helpers (shared across IIFE modules)
  // ============================================
  const KR_UTILS = Object.create(null);
  KR_UTILS.escapeHtml = function (str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };
  window.KR_UTILS = Object.freeze(KR_UTILS);

  // Single source of truth for critical enums (no scattered magic strings).
  window.KR_ENUMS = Object.freeze({
    UI_STATES: Object.freeze({
      LANDING: "LANDING",
      PLAYING: "PLAYING",
      END: "END",
      PAYWALL: "PAYWALL"
    }),
    GAME_MODES: Object.freeze({
      RUN: "RUN",
      SPRINT: "SPRINT"
    })
  });


  // ============================================
  // KR_CONFIG (single source of truth for mechanics)
  // ============================================
  window.KR_CONFIG = {

    // Product version (UI display, logs, SW cache key)
    version: "35",

    // Storage schema version (localStorage).
    // Change ONLY if you accept a migration/wipe.
    storageSchemaVersion: "1.0.0",

    // Le cache du Service Worker dérive exclusivement de KR_CONFIG.version via ?v=
    environment: isLocalhost
      ? "development"
      : (isGitHubPages ? "github-pages" : "production"),

    // ============================================
    // IDENTITY
    // ============================================
    identity: {
      appName: "Kitchen Rush",
      appUrl: "https://www.bonjourpickleball.fr/",
      parentUrl: "https://www.bonjourpickleball.fr/",

      // UI signature icon (in-card branding)
      uiLogoUrl: "./icons/kr-icon-512x512-rond.png"
    },

    seo: {
      title: "Kitchen Rush - Mobile Arcade Pickleball Game",
      description: "A mobile arcade game of reflexes, precision, and quick court reads inspired by pickleball. No ads. No account.",
      canonicalUrl: "https://www.bonjourpickleball.fr/",
      shareImageUrl: "https://www.bonjourpickleball.fr/icons/kr-icon-512x512.png",
      themeColor: "#1a2332",
      successTitle: "Activation Code Ready - Kitchen Rush",
      successDescription: "Payment successful. Your Kitchen Rush activation code is ready."
    },

    // ============================================
    // STORAGE (single source of truth)
    // ============================================
    storage: {
      storageKey: KR_STORAGE_KEY,
      vanityCodeStorageKey: KR_VANITY_CODE_STORAGE_KEY
    },


    // ============================================
    // GAME — shared gameplay primitives
    // ============================================
    game: {
      // Player - mobile-first lateral control + assisted forward step
      player: {
        baseXFrac: 0.5,
        baseYFrac: 0.92,
        maxForwardYFrac: 0.78,
        widthFrac: 0.22,
        heightPx: 8,
        moveSpeedPxPerSec: 900,
        hitReachPx: 84,
        autoForwardReachPx: 120,
        swingMs: 180,
        bodyRadiusPx: 14,
        headRadiusPx: 8,
        paddleLengthPx: 28,
        paddleThicknessPx: 6,
        lateralLeanPx: 7
      }
    },


    // ============================================
    // RUSH — fast arcade variant
    // ============================================
    rush: {
      // First N balls always stay out of the Kitchen.
      onboardingShield: 3,

      // Delay between landing and bounce state.
      reboundDelayMs: 150,

      // Travel speed curve for incoming balls.
      speedCurve: {
        base: 2.8,
        accelPerSec: 0.05
      },

      // Spawn cadence for new balls.
      spawnInterval: {
        initialMs: 1200,
        decayPerSec: 12,
        minMs: 400
      },

      // Player reaction window after a playable bounce.
      hitWindow: {
        initialMs: 350,
        decayPerSec: 2.5,
        minMs: 80
      },

      // Share of short Kitchen balls as intensity rises.
      kitchenShare: {
        base: 0.3,
        growthPerSec: 0.01,
        max: 0.7
      },

      // Score milestones for UI feedback.
      milestones: [25, 50, 100],

      // Runtime defaults for rush-generated balls.
      defaultBallType: "normal",
      defaultExchangeStage: "RALLY",
      defaultResponseType: "STANDARD",

      // Ball archetypes layered on top of the base arcade loop.
      ballTypes: {
        dink: {
          unlockAfterSec: 15,
          weight: 0.2,
          speedMultiplier: 0.5,
          forceKitchen: true,
          hitWindowMultiplier: 1.8,
          radiusMultiplier: 0.8
        },
        lob: {
          unlockAfterSec: 30,
          weight: 0.15,
          speedMultiplier: 0.35,
          forceKitchen: false,
          hitWindowMultiplier: 0.7,
          radiusMultiplier: 1.3
        },
        fast: {
          unlockAfterSec: 45,
          weight: 0.15,
          speedMultiplier: 2.0,
          forceKitchen: false,
          hitWindowMultiplier: 0.6,
          radiusMultiplier: 0.9
        }
      }
    },

    // ============================================
    // CLASSIC - pickleball-styled scoring and service
    // ============================================
    classic: {
      targetScore: 11,
      winBy: 2,
      betweenShotsMs: 320,
      betweenRalliesMs: 900,
      opponentReturnBase: 0.88,
      opponentReturnDecayPerShot: 0.08,
      opponentReturnMin: 0.34,
      opponentFaultBase: 0.08,
      opponentFaultMax: 0.24,
      serveIndicatorMs: 900,
      sideOutIndicatorMs: 900,
      playerStartsServing: true,
      serviceCourtRightLabel: "Right",
      serviceCourtLeftLabel: "Left"
    },

    // ============================================
    // DAILY — V2: same ball sequence for everyone each day
    // ============================================
    daily: {
      enabled: true,
      mode: "RUN"
    },


    // ============================================
    // JUICE — visual effect timings (Canvas, ms)
    // ============================================
    juice: {
      hitFlashMs: 120,
      faultFlashMs: 200,
      faultShakeMs: 200,
      faultShakeIntensity: 6,
      bounceRingMs: 300,
      sprintPenaltyMs: 400,
      milestoneGlowMs: 600,
      firstFaultOverlayMs: 1400,
      repeatFaultOverlayMs: 800
    },


    // ============================================
    // CANVAS — rendering dimensions & layout
    // ============================================
    canvas: {
      // Internal aspect ratio (portrait)
      aspectRatio: "9:16",

      // Kitchen line position (% from top of court area)
      kitchenLineY: 0.65,
      netYFrac: 0.27,
      perspectiveTopInsetFrac: 0.25,
      perspectiveBottomInsetFrac: 0.06,
      playerScaleNear: 1.42,
      playerScaleFar: 0.72,
      landingMarkerRadiusPx: 16,
      landingMarkerStrokePx: 3,
      trajectoryGuideDashPx: 12,
      ballGlowBlurPx: 20,
      ballCoreRingPx: 2,
      hudPanelBlurPx: 10,
      serviceTargetRadiusMult: 2.8,
      swingSlashWidthPx: 6,
      swingSlashAlpha: 0.26,
      opponentBaseAlpha: 0.26,
      farCourtGuideAlpha: 0.28,
      idleBobPx: 3,
      fastTrailWidthPx: 3,
      fastTrailAlpha: 0.28,
      impactParticleCount: 8,
      opponentIdleBobPx: 3,
      opponentReachPx: 10,
      playerRunBobPx: 6,
      playerRunSwingPx: 10,
      playerTiltMaxPx: 8,
      ballSpinAlpha: 0.22,
      ballPulsePx: 3,
      servicePulseAlpha: 0.22,

      // Minimum landing Y for non-kitchen balls (fraction of kitchenLineY)
      // Prevents balls from landing near the very top of the screen
      minLandingYFrac: 0.30,

      // Ball
      ballRadius: 18,

      // Hit tolerance (pixels) — tap doesn't need pixel-perfect precision
      hitTolerancePx: 50,

      // Tap anywhere: if true, tap hits the closest active ball regardless of position
      tapAnywhere: true,

      // Shadow growth factor (0..1 range relative to ball y-position)
      shadowGrowthFactor: 0.7,

      // Bounce animation: ball jumps up visually after landing
      bounceHeight: 0.08,
      bounceAnimMs: 250,

      // Hit-out animation: ball flies away after being hited
      hitOutMs: 300,
      hitOutDistance: 200,

      // Score popup: "+1" floats up from hit point
      scorePopupMs: 600,

      // Trail: number of trail segments behind falling ball
      trailSegments: 3,

      // Mobile canvas sharpness
      devicePixelRatioMax: 2,

      // Service / court readability
      serviceTargetGlowAlpha: 0.22,
      serviceGuideWidthPx: 2,
      serviceGuideDashPx: 10,
      serviceGuideShowMs: 900,
      opponentDepthFrac: 0.22,
      opponentXOffsetFrac: 0.18,
      opponentBodyScale: 0.72,
      opponentPaddleScale: 0.85,

      // Canvas colors (non-DOM: CSS cannot style canvas content)
      colors: {
        appBgTop: "#07131f",
        appBgBottom: "#050b13",
        courtBg: "#133a5e",
        courtBgDark: "#0d2942",
        courtStripe: "rgba(255,255,255,0.03)",
        kitchenBg: "#e35d5b",
        kitchenBgDark: "#b84245",
        kitchenOverlay: "rgba(255,255,255,0.05)",
        kitchenLine: "rgba(255,245,237,0.95)",
        kitchenLineGlow: "rgba(255,140,112,0.35)",
        kitchenLabelColor: "rgba(255,245,237,0.18)",
        line: "rgba(255,245,237,0.72)",
        lineSoft: "rgba(255,245,237,0.26)",
        netTape: "rgba(255,255,255,0.92)",
        netMesh: "rgba(214,228,242,0.16)",
        horizonGlow: "rgba(255,255,255,0.06)",

        ballDefault: "#ffd84d",
        ballKitchen: "#ffd84d",
        ballHit: "#fff4bf",
        ballFaulted: "#ef476f",
        ballMissed: "#7b8794",
        ballOutline: "rgba(88,60,0,0.42)",
        bounceRing: "#fff4bf",
        shadow: "rgba(6,11,18,0.42)",

        // Player / opponent
        paddle: "#f7fbff",
        paddleAccent: "#67d2ff",
        paddleGlow: "rgba(103,210,255,0.16)",
        playerAccent: "#67d2ff",
        playerShadow: "rgba(5,8,14,0.28)",
        opponent: "rgba(255,255,255,0.58)",
        opponentPaddle: "rgba(103,210,255,0.68)",
        serviceTarget: "rgba(255,216,77,0.30)",
        serviceGuide: "rgba(255,255,255,0.28)",
        hudPanel: "rgba(7,19,31,0.78)",
        hudBorder: "rgba(255,245,237,0.14)",
        hudAccent: "rgba(255,216,77,0.96)",
        hudTextMuted: "rgba(221,232,242,0.76)",
        serviceLane: "rgba(255,216,77,0.12)",
        swingSlash: "rgba(103,210,255,0.22)",
        fastTrail: "rgba(255,216,77,0.20)",
        impactParticle: "rgba(255,255,255,0.72)",
        opponentGhost: "rgba(255,255,255,0.24)",
        ballSeam: "rgba(88,60,0,0.22)",
        scoreGlow: "rgba(255,216,77,0.24)",

        // Score popup
        scorePopup: "#f7fbff",

        // "WAIT" indicator on kitchen balls
        waitIndicator: "#fff4bf",

        // Ball type accents
        ballDink: "rgba(255,244,191,0.95)",
        ballLob: "rgba(255,255,255,0.95)",
        ballFast: "rgba(255,166,77,0.95)",

        // Milestone tint colors (court + kitchen at 25/50/100 hits)
        milestone1CourtBg: "#16456f",
        milestone1KitchenBg: "#ef6d63",
        milestone2CourtBg: "#0f3b63",
        milestone2KitchenBg: "#f27b4b",
        milestone3CourtBg: "#103858",
        milestone3KitchenBg: "#ff8a57"
      }
    },


    // ============================================
    // AUDIO
    // ============================================
    audio: {
      enabled: true,
      hitVolume: 0.6,
      faultVolume: 0.4,
      bounceVolume: 0.3
    },


    // ============================================
    // HAPTIC
    // ============================================
    haptic: {
      enabled: true,
      hitPattern: [15],
      faultPattern: [30, 50, 30]
    },



    // ============================================
    // CONTROLS — mobile first
    // ============================================
    controls: {
      keyboardEnabled: true,
      pointerMoveEnabled: true,
      touchButtonsEnabled: true,
      touchNudgeMs: 40,
      pointerSmoothing: 0.18,
      leftKeys: ["ArrowLeft", "a", "A"],
      rightKeys: ["ArrowRight", "d", "D"],
      hitKeys: [" ", "Enter"]
    },

    // ============================================
    // LIMITS — monetization by replayability
    // ============================================
    limits: {
      freeRuns: 2
    },


    // ============================================
    // CHALLENGES — thresholds for Court Challenges
    // ============================================
    challenges: {
      nearBestGap: 5,         // show "near best" if gap ≤ this
      cleanRunMinScore: 5,  // min score to celebrate a 0-fault run
      streakThreshold: 8,     // show streak challenge if bestStreak ≥ this
      streakTargetBonus: 3,   // target = streak + this
      faultThreshold: 2,      // show fault coaching if faults ≥ this
      lowAccuracyPct: 60,     // show accuracy challenge if < this %
      lowAccuracyMinScore: 3 // min score for accuracy to be meaningful
    },


    // ============================================
    // SPRINT — secret mode (chest discovery)
    // ============================================
    sprint: {
      enabled: true,
      premiumOnly: true,
      durationMs: 20000,
      faultPenaltyMs: 2000,

      // Teaser: free users can try N sprint runs (lifetime, device-local)
      freeRunsLimit: 2,

      // Entry points (canonical gates)
      // END: show chest after N completed runs (0 = show from first END)
      // LANDING: show chest after N completed runs
      gates: {
        endAfterRuns: 0,
        landingAfterRuns: 1
      },

      // Gesture: single tap (KISS)
      tapWindowMs: 900,
      tapsRequired: 1,

      // No feedback between items (arcade continuous)
      feedback: "none"
    },


    // ============================================
    // PREMIUM CODE
    // ============================================
    premiumCodePrefix: "KR",
    premiumCodeRegex: "^KR-[A-Z0-9]{4}-[A-Z0-9]{4}$",
    acceptCodeOncePerDevice: true,

    // ============================================
    // PRICING (Stripe)
    // ============================================
    currency: "USD",
    earlyPriceCents: 499,
    standardPriceCents: 699,
    earlyPriceWindowMs: 20 * 60 * 1000,
    stripeEarlyPaymentUrl: "REPLACE_WITH_STRIPE_EARLY_URL",
    stripeStandardPaymentUrl: "REPLACE_WITH_STRIPE_STANDARD_URL",
    successRedirectUrl: "./success.html",


    // ============================================
    // MARKETING (opt-in only; Stripe receipt email is NOT marketing consent)
    // ============================================
    marketing: {
      // External signup form URL (Mailchimp / ConvertKit / Buttondown / etc.)
      // Fail-closed in success.html if not set / still placeholder.
      updatesUrl: "",

      // Order bump - serverless "trust-by-design" via ConvertKit embed.
      // Fail-closed in success.html unless explicitly enabled AND fully configured.
      orderBump: {
        enabled: false,           // TBD: enable when product exists
        convertKitUid: "",
        convertKitScriptSrc: ""
      }
    },

    // ============================================
    // LANDING STATS (micro-graphs, UI-only)
    // ============================================
    landingStats: {
      enabled: true,

      // Spark bars: show last N run scores (RUN mode only)
      sparkRunsCount: 5
    },

    // ============================================
    // HOUSE AD (cross-sell to other games)
    // ============================================
    houseAd: {
      enabled: true,
      premiumOnly: false,
      url: "",                   // Keep placeholder until ad destination is live.
      showAfterEnd: false,

      // Contextual cadence by completed runs.
      showAfterRunCompletes: [15, 30],

      // "Remind later" hide window (mechanics)
      hideMs: 24 * 60 * 60 * 1000  // 24h
    },

    // ============================================
    // WAITLIST (future products/features notification)
    // ============================================
    waitlist: {
      enabled: true,

      // Contextual cadence by completed runs.
      showAfterRunCompletes: [10],

      placement: "landing-card",
      afterPoolExhaustedOnly: false,
      showModalOneShot: false,

      // Obfuscated email (anti-scraping)
      toEmailObfuscated: "contact&#64;bonjourpickleball&#46;fr",
      subjectPrefix: "[Kitchen Rush][Waitlist]"
    },

    // ============================================
    // POST-COMPLETION (reserved for future use)
    // ============================================
    postCompletion: {
      enabled: false,
      waitlistEnabled: false,
      houseAdEnabled: false
    },

    // ============================================
    // ANONYMOUS STATS SHARING (opt-in, no backend)
    // ============================================
    statsSharing: {
      enabled: true,
      emailSubject: "[Kitchen Rush][Stats] Anonymous stats",
      schemaVersion: "1.0",

      // Prompt rules (END screen only, never interrupt gameplay)
      afterPoolExhaustedOnly: false,
      showModalOneShot: false,

      // Contextual cadence:
      // - 3: early familiarity without asking on the first two runs
      // - 7: confirmation of repeated play without prompting every session
      // - 10: first habit milestone
      // - 50: long-term player check-in
      promptAfterRunCompletes: [3, 7, 10, 50],

      // Keep the cadence clean; do not add extra prompts just because free runs are exhausted.
      promptOnFreeRunsExhausted: false
    },


    // ============================================
    // SUPPORT
    // ============================================
    support: {
      emailObfuscated: "contact&#64;bonjourpickleball&#46;fr",
      subjectPrefix: "[Kitchen Rush][Contact]"
    },


    // ============================================
    // UI TIMING (critical for feel)
    // ============================================
    ui: {
      // Toast / micro-feedback timing buckets
      toast: {
        default: {
          delayMs: 0,
          durationMs: 1400
        },
        positive: {
          delayMs: 0,
          durationMs: 1200
        }
      },

      // Gameplay overlay dismiss policy (UI-only, fail-closed)
      toastDismissOnTap: true,

      // Overlays (PLAYING)
      lifeLostOverlayMs: 2000,
      runStartOverlayMs: 2400,

      // Pulses (HUD)
      gameplayPulseMs: 950,

      // END: "Record moment" window
      endRecordMomentMs: 900,

      // Paywall ticker (drives mm:ss countdown)
      paywallTickerMs: 1000,

      // Paywall urgency (pulse when time is low)
      paywallUrgency: {
        enabled: false,
        pulseBelowMs: 5 * 60 * 1000
      }
    },


    // ============================================
    // INSTALL PROMPT (PWA)
    // ============================================
    installPrompt: {
      enabled: true,
      triggerAfterFirstCompletedRun: true
    },

    // ============================================
    // SHARE
    // ============================================
    share: {
      enabled: true,
      verificationSalt: "kr2026"
    },

    // ============================================
    // UX FLOW (retention + shell discipline)
    // ============================================
    uxFlow: {
      houseAdMinRunCompletes: 999999,
      waitlistMinRunCompletes: 999999,
      autoShareNewBestMinScore: 999999,
      autoShareDailyMinScore: 999999,
      autoShareRegularMinScore: 999999,
      classicLongRallyMinHits: 5,
      classicNearBestGap: 5
    },

    // ============================================
    // MICRO-FEEDBACK (arcade streaks, overlays)
    // ============================================
    microFeedback: {
      // Minimum score delta between consecutive overlays (avoids spam)
      cooldownScoreDelta: 3,

      // Streak tier thresholds (consecutive clean hits without fault)
      streakThresholds: {
        start: 3,
        building: 6,
        strong: 10,
        elite: 15,
        legendary: 20
      }
    },

    // ============================================
    // DEBUG
    // ============================================
    debug: {
      enabled: isLocalhost || isGitHubPages,
      logLevel: isLocalhost ? "debug" : (isGitHubPages ? "log" : "warn")
    },

    // ============================================
    // SERVICE WORKER / PWA
    // ============================================
    serviceWorker: {
      enabled: !isLocalhost,
      autoUpdate: true,
      showUpdateNotifications: true
    }
  };


  // ============================================
  // KR_WORDING (visible copy — all user-facing text)
  // ============================================
  //
  // ------------------------------------------
  // KITCHEN RUSH — LEXICAL IDENTITY (Precision)
  // ------------------------------------------
  //
  // Core Intention:
  // Kitchen Rush speaks like a sports clock.
  // Short. Factual. Adult. Performance-oriented.
  //
  // Emotional posture:
  // - Terse
  // - Precise
  // - Unemotional
  // - Competitive (against yourself)
  //
  // Dominant lexical field:
  // - hit, fault, miss
  // - game over, new best
  // - play again, unlock
  //
  // Explicit exclusions:
  // - No emoji in UI (ever)
  // - No "AMAZING!" / "INCREDIBLE!" / "AWESOME!"
  // - No motivational coach tone
  // - No guilt ("You're missing out!")
  // - Avoid empty hype vocabulary; prefer concrete rally language
  // - No "level", "stage", "round", "match", "points"

  window.KR_WORDING = {
    brand: {
      creatorLine: "Created by Carole Stromboni for Bonjour Pickleball",
      creatorLineHtml: ""
    },

    system: {
      close: "Close",
      home: "Home",
      versionPrefix: "v",

      // Short month names (used in daily badge + share card date)
      monthsShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],

      updateAvailable: "Update available.",
      dismiss: "Dismiss",
      closeIcon: "\u2715",

      offlinePayment: "Payment requires an internet connection.",
      checkoutUnavailable: "Checkout is not live yet.",
      copied: "Copied",
      copyFailed: "Copy failed",
      more: "How to play",
      notNow: "Not now",

      playAria: "Start a new run",
      shareAria: "Share your score",
      scoreAria: "Score",
      endActionsAria: "End screen actions",

      premiumUnlockedToast: "Premium unlocked",
      downloaded: "Downloaded",
      storageSaveFailedToast: "Saving is disabled in this browser mode. Your progress may be lost if you refresh.",

      // Fatal / loading (main.js bootstrap)
      loadingLabel: "Loading...",
      classicLoading: "Classic loading…",
      reloadCta: "Reload",
      fatalGeneric: "Unable to load the game. Please refresh the page.",
      fatalModules: "Unable to load game components. Please refresh the page.",
      fatalConfig: "Configuration error: Application settings not loaded.",
      fatalWording: "Configuration error: UI wording not loaded.",
      fatalStorage: "Your browser doesn't support local storage. Please use a modern browser.",
      fatalContainer: "Critical error: App container not found.",
      fatalPromise: "An unexpected issue occurred. Please refresh the page."
    },


    footer: {
      contact: "Contact",
      privacy: "Privacy",
      terms: "Terms",
      press: "Press"
    },


    success: {
      title: "Payment successful",
      subtitle: "Your activation code is ready. Save it, then activate it in the game on this device.",

      codeLabel: "Your activation code",
      clearDataWarning: "If you clear site data or switch browser or device, you will need this code again.",

      howToActivateTitle: "How to activate",
      howToActivateStep1: "Return to the game.",
      howToActivateStep2Prefix: "Tap",
      howToPlayLabel: "How to play",
      activateWithCodeLabel: "Activate with a code",
      howToActivateStep3Prefix: "Paste your code and tap",
      activateLabel: "Activate",

      whatYouGetTitle: "What you get",
      benefitsTitle: "What you get",
      benefitUnlimitedRuns: "Unlimited Classic and Rush runs on this device.",
      benefitSprint: "Rush stays unlocked.",
      benefitPersonalBest: "Best scores stay saved on this device.",

      ctaBackToGame: "Back to game",
      ctaDownload: "Download code (.txt)",
      shortcutHint: "Open How to play, then use Activate with a code.",

      thankYouLine: "Thank you for supporting an independent game by Bonjour Pickleball.",
      supportLabel: "Need help?",

      copyCta: "Copy code",
      copyAgainCta: "Copy code again",
      tipNoRecover: "Save this code somewhere safe. This game does not keep a server copy.",
      txtTitle: "Your Kitchen Rush activation code",
      txtSaveLine: "Save this code somewhere safe.",
      txtNoRecoverLine: "This game does not keep a server copy.",

      // Order bump (if enabled in marketing config)
      orderBumpTitle: "",          // TBD: product name
      orderBumpBody: ""            // TBD: product description
    },


    landing: {
      title: "Kitchen Rush",
      tagline: "Stay out of the Kitchen.",
      subtitle: "A mobile arcade game of reflexes, precision, and quick court reads inspired by pickleball.",
      subtitleAfterFirstRun: "Stay clean, own the Kitchen, beat your best.",

      // Daily challenge badge (shown when daily.enabled)
      dailyBadge: "Daily Challenge",
      dailyDateTemplate: "{month} {day}",
      dailyExplain: "Play today's shared Classic sequence.",
      dailyCta: "Play Daily",
      dailyInfoTitle: "Daily Challenge",
      dailyInfoBody: "Daily Challenge is today's shared Classic run. Same sequence for everyone today. It uses Classic rules and counts toward Classic free runs.",

      ctaPlay: "Play Classic",
      touchLeftLabel: "Left",
      touchHitLabel: "Hit",
      touchRightLabel: "Right",
      ctaPlayAfterFirstRun: "Play again",
      serverYou: "Server: You",
      serverOpponent: "Server: Opponent",
      sideLeft: "Left",
      sideRight: "Right",
      sideTemplate: "Serve from {side}",
      scoreTemplate: "{player}-{opponent}",
      sideOut: "Side out",
      pointWon: "Point",
      startOverlayTargetTemplate: "First to {target}. Win by {winBy}.",
      gamePointYou: "Game point.",
      gamePointOpponent: "Pressure point.",
      longRallyPoint: "Long rally.",
      cleanPoint: "Clean point.",
      holdServe: "Hold serve.",
      breakServe: "Break serve.",
      winOverlay: "You took it.",

      bestLabel: "Best",
      bestAriaTemplate: "Best score: {best}",
      bestTargetTemplate: "Can you top {target}?",
      premiumLabel: "Unlimited court time",

      // Landing stats (spark bars)
      runsLabel: "Runs",

      // Lifetime counter (cumulative investment — Eyal Hook model)
      lifetimeTemplate: "{total} lifetime hits",

      // Post-paywall block (LANDING after free runs exhausted)
      postPaywallTitle: "Free runs are done.",
      postPaywallBody: "Unlock unlimited court time on this device.",
      postPaywallCta: "See options",

      // Post-paywall + secret bonus hint
      postPaywallSbTitle: "",
      postPaywallSbBody: ""
    },


    ui: {
      livesLabel: "",
      livesAria: "{lives} lives remaining",
      scoreLabel: "",
      scoreAriaTemplate: "Score: {playerScore}-{opponentScore}",
      gameOverTitle: "Game over",

      // Start-of-run overlay (economy)
      startRunTypeFree: "FREE RUN",
      startRunTypeLastFree: "Last free run.",
      startRunTypeUnlimited: "",

      // Chance/life state overlays
      lastLifeOverlay: "Last life.",
      gameOverOverlay: "Game over.",
      doubleBounceOverlay: "Let it bounce.",

      // HUD deltas
      lifeLostDeltaText: "-1",
      scoreGainedDeltaText: "+1",

      // Milestones (brief flash, no interruption)
      // Arc B — rare narrator voice. Mystery box: "What happens deeper?"
      milestone25: "",
      milestone50: "",
      milestone100: ""
    },


    sprint: {
      // Chest (discovery)
      chestAria: "Secret bonus",
      chestHint: "Tap the gift to unlock Rush.",

      // Modal one-shot (first tap ever)
      modalTitle: "You found Rush",
      modalBody: "20 seconds on the clock. No lives. Every Kitchen fault costs 2 seconds. Keep the rally clean and score fast.",
      modalCta: "Let's go",

      // Teaser (free runs limit)
      startOverlayFreeRunsLimitLine: "{remaining}/{limit} free Rush runs left",
      freeLimitReachedTitle: "That was a rally.",
      freeLimitReachedBody: "You've used your {limit} free Rush runs.\n\nPremium unlocks unlimited Rush.",
      freeLimitReachedCta: "Unlock Rush",
      freeLimitReachedClose: "Not now",

      // In-game HUD
      title: "Rush",
      timerLabel: "{remaining}s",
      penaltyFlash: "-2s",

      // Start overlay
      startOverlayLine1: "20 seconds. No lives.",
      startOverlayLine2: "Kitchen faults cost 2 seconds.",
      startOverlayTapAnywhere: "Tap to start",

      // End screen
      endTitle: "Time!",
      scoreLine: "{score} Rush score in 20s",
      bestLine: "Rush best: {best}",
      freeRunsLeftLine: "{remaining}/{limit} free Rush runs left.",
      newBest: "New Rush best!",
      playAgain: "Rush again",
      backToRuns: "Back to court",

      // End toast
      endGameOverToast: "Time's up",

      // CTA
      ctaPlayAgain: "Rush again"
    },


    end: {
      title: "Game over",

      scoreLine: "Final score: {score}",
      personalBestLine: "Personal best: {best}",
      bestStreakLine: "Best rally: {streak} in a row",

      newBest: "New personal best!",

      // Near-best encouragement
      almostBest: "Just {gap} away from your best.",

      // Debrief
      debriefAccuracy: "{accuracy}% accuracy",
      debriefFaults: "{faults} Kitchen faults",
      debriefMisses: "{misses} missed",
      debriefDuration: "{seconds}s on court",

      // Free runs remaining
      freeRunLeft: "{remaining} free run left.",

      playAgain: "Play again",
      playAgainNearBest: "So close — one more",
      playAgainAfterBest: "Defend your record",
      retryNearBest: "One clean run could beat your best.",
      retryFaults: "Too many Kitchen faults. The bounce is the run.",
      retryWin: "Back on court. Defend it.",
      retryLoss: "One more. Stay patient in the Kitchen.",

      shareTitle: "Share"
    },


    firstRun: {
      trustLine: "No ads. No tricks. Just you and the court.",
      kitchenHint: "Yellow ball in the Kitchen? Wait for the bounce, then tap.",
      rule1: "Move left and right, then hit on time",
      rule2: "Yellow ball = Kitchen = wait for bounce first",
      rule3: "Classic uses score and side out. Rush uses time pressure."
    },


    paywall: {
      headline: "Own the court.",

      headlineLastFree: "That was your last free run.",

      valueTitle: "What you get",
      trustTitle: "No surprises",

      valueBullets: [
        "Unlimited Classic and Rush runs on this device",
        "Classic with score, serve, side out, and Kitchen pressure",
        "Rush for short, faster sessions"
      ],

      bridgeTitle: "Free runs are done.",
      bridgeBody: "Unlock unlimited court time on this device.",

      // Personal progress anchor (shown only if best > 0)
      progressLineTemplate: "Your best score: {best}. Keep going.",

      trustLine: "One purchase. Local unlock. No subscription.",
      trustBullets: [
        "One-time payment, no subscription",
        "No ads, ever — just you and the court",
        "No signup or account needed",
        "Secure checkout via Stripe"
      ],

      // EARLY-only conversion bump
      savingsLineTemplate: "",

      checkoutNote: "Secure checkout via Stripe.",

      ctaEarly: "Unlock",
      ctaStandard: "Unlock",
      cta: "Unlock",

      alreadyHaveCode: "Already have a code? Redeem it here.",
      deviceNote: "Premium stays unlocked on this device. No account needed.",

      earlyBadgeLabel: "",
      earlyLabel: "",
      standardLabel: "One-time unlock",

      timerLabel: "",

      postEarlyLine1: "",
      postEarlyLine2: "{standardPrice} - One-time purchase. Yours forever.",

      ctaNotNow: "Not now"
    },


    howto: {
      title: "How to play",
      line1: "Classic is a short-form pickleball-inspired rally game.",
      line2: "Read the ball, move into position, and hit on time.",
      line3: "If the ball lands in the Kitchen, let it bounce before you play it.",

      ruleTitle: "The Kitchen rule",
      ruleSentence: "The Kitchen is the non-volley zone near the net. Let serves and returns bounce, and never volley from the Kitchen.",

      premiumTitle: "Premium",
      alreadyPremium: "Premium is already active on this device.",
      activateTitle: "Activate with a code",
      activateLine1: "Already have a premium code? Activate it here.",
      activateLine2: "No account needed. Your code stays on this device.",
      activationCodeLabel: "Activation code",
      activationCodePlaceholder: "KR-XXXX-XXXX",
      enterCode: "Enter a code.",
      codeRejected: "Code rejected.",
      activateCta: "Activate",
      codeInvalid: "Invalid code format.",
      codeUsed: "This device already used a code.",
      codeOk: "Premium enabled on this device.",
      redeemCta: "OK",

      autoActivateTitle: "Premium code ready",
      autoActivateLine1: "Your premium code is already saved on this device.",
      autoActivateLine2: "Activate Premium now?",
      autoActivateCta: "Activate now",
      autoActivateLater: "Not now"
    },


    share: {
      ctaLabel: "Share score",
      emailAria: "Share via email",
      toastCopied: "Copied!",
      templateDefault: "Kitchen Rush — score {score} {hashtag}\nCan you top that?\n{url}",
      templateFault: "Kitchen Rush — score {score} {hashtag}\nKitchen fault. Your turn.\n{url}",
      templateNewBest: "Kitchen Rush — new best {score} {hashtag}\nYour turn.\n{url}",
      templateSprint: "Kitchen Rush — Rush {score} in 20s {hashtag}\nFast round. Beat that.\n{url}",
      templateDaily: "Kitchen Rush Daily ({date}) — score {score} {hashtag}\nSame daily sequence for everyone.\n{url}",

      // Hashtag (dynamic: #KitchenRush{score})
      hashtagPrefix: "#KitchenRush",

      // Share card modal (auto-shown after new best)
      cardModalTitle: "New personal best!",

      // V2: Share card labels (canvas image)
      cardSprintLabel: "Rush",
      cardDailyLabel: "Daily Challenge",
      cardScoreLabel: "Score",
      cardBestLabel: "Best: {best}",
      cardDateFormat: "{month} {day}, {year}",
      cardTagline: "bonjourpickleball.fr"
    },


    installPrompt: {
      title: "Install Kitchen Rush",
      body: "Play instantly. No browser tabs. On iPhone: Share > Add to Home Screen.",
      ctaPrimary: "Add to home screen",
      ctaSecondary: "Later"
    },


    houseAd: {
      eyebrow: "More from Bonjour Pickleball",
      title: "Try another game",
      bodyLine1: "You have a few runs behind you now.",
      bodyLine2: "If another pickleball game is live, you can open it here.",
      ctaPrimary: "Open game",
      ctaRemindLater: "Later",

      landingTitle: "More from Bonjour Pickleball",
      landingBodyLine1: "You have a few runs behind you now.",
      landingBodyLine2: "If another pickleball game is live, you can open it here.",
      landingCtaPrimary: "Open game",
      landingCtaRemindLater: "Later"
    },


    waitlist: {
      ctaLabel: "Get updates from Bonjour Pickleball after 10 completed runs.",
      disclaimer: "Optional. No account. No spam.",
      title: "Join the Bonjour Pickleball waitlist",
      bodyLine1: "Get updates about future games or features.",
      bodyLine2: "Optional: add one idea if you want.",
      inputPlaceholder: "Optional: share one idea.",
      cta: "Open email",

      emailSubjectSuffix: "Waitlist",
      emailBodyTemplate: "Hi!\n\nI'd like to join the Bonjour Pickleball waitlist for Kitchen Rush updates.\n\nOptional idea:\n{idea}\n\nThanks!"
    },


    statsSharing: {
      sectionTitle: "Anonymous stats (optional)",
      buttonLabel: "Share anonymous stats",

      promptTitle: "Help improve Kitchen Rush",
      promptBodyTemplate: "You've completed {runCompletes} runs. Share anonymous stats if you want to help improve the game. You can review everything before sending.",
      promptBodyLastFree: "That was your last free run. Share anonymous stats if you want to help improve the game. You can review everything before sending.",
      promptCtaPrimary: "Preview & share",
      promptCtaSecondary: "Not now",

      modalTitle: "Help improve the game",
      modalDescription: "Share anonymous gameplay stats with the creator. No personal data is collected. You can review everything before sending.",
      previewLabel: "Data to be shared:",
      ctaSend: "Send via email",
      ctaCancel: "Cancel",
      ctaLater: "Show me later",
      ctaCopy: "Copy to clipboard",
      noStatsToast: "No stats to share yet.",
      successToast: "Email app opened. Send to share your stats.",
      copyToast: "Stats copied to clipboard."
    },


    support: {
      modalTitle: "Contact Bonjour Pickleball",
      modalBodyLine1: "Email is the fastest way to reach us.",
      modalBodyLine2: "Use the address below or open your email app.",
      emailSubjectSuffix: "Feedback",
      ctaCopy: "Copy email",
      ctaOpen: "Open email app",

      emailBodyTemplate: "Hi!\n\nI'm writing about Kitchen Rush.\n\nMessage:\n\n\n\nThanks!"
    },


    microFeedback: {
      // Streak tiers — pickleball rally language + diverse pro nods
      // Waters = Anna Leigh Waters (youngest #1 ever, 17yo prodigy)
      // Jardim = Simone Jardim (Brazilian legend, Hall of Fame 2024)
      // Devilliers = Jay "The Flying Frenchman" (French #1 on US tour)
      // Johns = Ben Johns (GOAT, 167 titles)
      streakStart: "3 clean in a row",
      streakBuilding: "6 clean - keep it clean",
      streakStrong: "10 clean - Jardim vibes",
      streakElite: "15 clean - long rally",
      streakLegendary: "20 clean - Waters level",
      streakAgain: "{streak} clean",

      // One-shot moments
      kitchenMaster: "Kitchen master!",
      lastLife: "Last life — match point.",
      closeCall: "Close call!",
      tooEarly: "Too early!",
      firstFaultExplain: "Yellow ball = wait for BOUNCE first!"
    },


    // Arc B — Reserved for future implementation (Caro's design TBD)


    // Court Challenges — contextual micro-objectives (Deci/Ryan + Csikszentmihalyi)
    // Shown on END screen + LANDING (returning). One challenge max. Priority order.
    // All templates receive: {best}, {score}, {faults}, {streak}, {target}, {accuracy}, {gap}
    challenges: {
      // END screen challenges (priority order)
      newBestChallenge: "New record: {score}. Now defend {target}.",
      cleanRun: "Zero Kitchen faults. Can you do it again?",
      streakChallenge: "Best rally this run: {streak}. Can you hit {target}?",
      faultHeavy: "{faults} Kitchen faults. Wait for the bounce.",
      lowAccuracy: "{accuracy}% accuracy. Patience wins rallies.",
      // Sprint
      sprintChallenge: "{score} in 20s. Go for {target}.",
      // LANDING challenges (returning player — based on previous run)
      landingComeback: "Last run: {faults} Kitchen faults. Stay clean this time.",
      landingStreakPush: "Your best rally was {streak}. Push it further.",
      landingNearBest: "{gap} away last time. This could be the one."
    },


    notFound: {
      title: "Out of bounds.",
      line1: "This page went wide.",
      line2: "The court is right where you left it.",
      cta: "Back to court"
    }

  };


  // ============================================
  // Soft validation + brand hydration
  // Exported for footer.js to call at DOMContentLoaded
  // (config.js is pure data — no DOM access here)
  // ============================================
  window.KR_CONFIG_BOOT = {
    validateConfigSoft: function () {
      const cfg = window.KR_CONFIG;
      if (!cfg || typeof cfg !== "object") throw new Error("KR_CONFIG_BOOT.validateConfigSoft: KR_CONFIG missing");

      const warn = (...args) => {
        if (cfg.debug && cfg.debug.enabled) console.warn("[KR_CONFIG]", ...args);
      };

      try { new RegExp(cfg.premiumCodeRegex); } catch (e) { warn("premiumCodeRegex is invalid", e); }

      const appUrl = String((cfg.identity && cfg.identity.appUrl) || "").trim();
      if (!appUrl) warn("identity.appUrl is missing (used for share URL)");
      else if (!/^https?:\/\//i.test(appUrl)) warn("identity.appUrl must start with http:// or https://", appUrl);

      if (!cfg.stripeEarlyPaymentUrl || String(cfg.stripeEarlyPaymentUrl).includes("REPLACE")) warn("Stripe early URL needs to be configured");
      if (!cfg.stripeStandardPaymentUrl || String(cfg.stripeStandardPaymentUrl).includes("REPLACE")) warn("Stripe standard URL needs to be configured");

      
      const freeRunsNum = (cfg.limits && Number.isFinite(Number(cfg.limits.freeRuns))) ? Number(cfg.limits.freeRuns) : null;
      if (freeRunsNum == null || Math.floor(freeRunsNum) !== freeRunsNum || freeRunsNum < 0 || freeRunsNum > 99) warn("limits.freeRuns must be an integer in [0..99]");

      if (cfg.sprint && cfg.sprint.enabled === true) {
        const gates = cfg.sprint.gates;
        if (!gates || typeof gates !== "object") warn("sprint.enabled true but sprint.gates is missing");
      }

      if (cfg.support && !cfg.support.emailObfuscated) warn("support.emailObfuscated missing");
      if (cfg.waitlist && cfg.waitlist.enabled && !cfg.waitlist.toEmailObfuscated) warn("waitlist.enabled true but toEmailObfuscated missing");
    },

    validateConfigStrict: function () {
      const cfg = window.KR_CONFIG;
      const enums = window.KR_ENUMS;
      const fail = (msg) => { throw new Error("KR_CONFIG strict validation failed: " + msg); };
      const reqObj = (obj, name) => {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) fail(name + " missing or invalid");
        return obj;
      };
      const reqStr = (value, name) => {
        const s = String(value == null ? "" : value).trim();
        if (!s) fail(name + " missing or empty");
        return s;
      };
      const reqCheckoutUrl = (value, name) => {
        const s = reqStr(value, name);
        if (cfg.environment !== "development" && s.indexOf("REPLACE") !== -1) {
          fail(name + " still contains a placeholder value");
        }
        if (s.indexOf("REPLACE") === -1 && !/^https:\/\//i.test(s)) {
          fail(name + " must start with https://");
        }
        return s;
      };
      const reqNum = (value, name, opts) => {
        const n = Number(value);
        if (!Number.isFinite(n)) fail(name + " must be a finite number");
        if (opts && Number.isFinite(opts.min) && n < opts.min) fail(name + " must be >= " + opts.min);
        if (opts && Number.isFinite(opts.max) && n > opts.max) fail(name + " must be <= " + opts.max);
        if (opts && opts.integer === true && Math.floor(n) !== n) fail(name + " must be an integer");
        return n;
      };
      const reqBool = (value, name) => {
        if (typeof value !== "boolean") fail(name + " must be a boolean");
        return value;
      };
      const reqIntArray = (values, name) => {
        if (!Array.isArray(values) || values.length < 1) fail(name + " must be a non-empty array");
        let prev = 0;
        values.forEach((value, index) => {
          const n = reqNum(value, name + "[" + index + "]", { min: 1, integer: true });
          if (index > 0 && n <= prev) fail(name + " must be strictly increasing");
          prev = n;
        });
        return values;
      };

      reqObj(cfg, "KR_CONFIG");
      reqObj(enums, "KR_ENUMS");
      reqObj(enums.UI_STATES, "KR_ENUMS.UI_STATES");
      reqObj(enums.GAME_MODES, "KR_ENUMS.GAME_MODES");

      reqStr(enums.UI_STATES.LANDING, "KR_ENUMS.UI_STATES.LANDING");
      reqStr(enums.UI_STATES.PLAYING, "KR_ENUMS.UI_STATES.PLAYING");
      reqStr(enums.UI_STATES.END, "KR_ENUMS.UI_STATES.END");
      reqStr(enums.UI_STATES.PAYWALL, "KR_ENUMS.UI_STATES.PAYWALL");
      reqStr(enums.GAME_MODES.RUN, "KR_ENUMS.GAME_MODES.RUN");
      reqStr(enums.GAME_MODES.SPRINT, "KR_ENUMS.GAME_MODES.SPRINT");

      reqObj(cfg.identity, "KR_CONFIG.identity");
      reqStr(cfg.identity.appName, "KR_CONFIG.identity.appName");
      reqStr(cfg.version, "KR_CONFIG.version");
      reqStr(cfg.storageSchemaVersion, "KR_CONFIG.storageSchemaVersion");

      reqObj(cfg.storage, "KR_CONFIG.storage");
      reqStr(cfg.storage.storageKey, "KR_CONFIG.storage.storageKey");
      reqStr(cfg.storage.vanityCodeStorageKey, "KR_CONFIG.storage.vanityCodeStorageKey");

      const game = reqObj(cfg.game, "KR_CONFIG.game");
      const player = reqObj(game.player, "KR_CONFIG.game.player");
      reqNum(player.baseXFrac, "KR_CONFIG.game.player.baseXFrac", { min: 0, max: 1 });
      reqNum(player.baseYFrac, "KR_CONFIG.game.player.baseYFrac", { min: 0, max: 1 });
      reqNum(player.maxForwardYFrac, "KR_CONFIG.game.player.maxForwardYFrac", { min: 0, max: 1 });
      reqNum(player.widthFrac, "KR_CONFIG.game.player.widthFrac", { min: 0.01, max: 1 });
      reqNum(player.heightPx, "KR_CONFIG.game.player.heightPx", { min: 1, integer: true });
      reqNum(player.moveSpeedPxPerSec, "KR_CONFIG.game.player.moveSpeedPxPerSec", { min: 1 });
      reqNum(player.hitReachPx, "KR_CONFIG.game.player.hitReachPx", { min: 1 });
      reqNum(player.autoForwardReachPx, "KR_CONFIG.game.player.autoForwardReachPx", { min: 0 });
      reqNum(player.swingMs, "KR_CONFIG.game.player.swingMs", { min: 1, integer: true });
      reqNum(player.bodyRadiusPx, "KR_CONFIG.game.player.bodyRadiusPx", { min: 1, integer: true });
      reqNum(player.headRadiusPx, "KR_CONFIG.game.player.headRadiusPx", { min: 1, integer: true });
      reqNum(player.paddleLengthPx, "KR_CONFIG.game.player.paddleLengthPx", { min: 1, integer: true });
      reqNum(player.paddleThicknessPx, "KR_CONFIG.game.player.paddleThicknessPx", { min: 1, integer: true });
      reqNum(player.lateralLeanPx, "KR_CONFIG.game.player.lateralLeanPx", { min: 0 });

      const rush = reqObj(cfg.rush, "KR_CONFIG.rush");
      reqNum(rush.onboardingShield, "KR_CONFIG.rush.onboardingShield", { min: 0, integer: true });
      reqNum(rush.reboundDelayMs, "KR_CONFIG.rush.reboundDelayMs", { min: 1, integer: true });
      reqStr(rush.defaultBallType, "KR_CONFIG.rush.defaultBallType");
      reqStr(rush.defaultExchangeStage, "KR_CONFIG.rush.defaultExchangeStage");
      reqStr(rush.defaultResponseType, "KR_CONFIG.rush.defaultResponseType");
      reqObj(rush.speedCurve, "KR_CONFIG.rush.speedCurve");
      reqNum(rush.speedCurve.base, "KR_CONFIG.rush.speedCurve.base", { min: 0.1 });
      reqNum(rush.speedCurve.accelPerSec, "KR_CONFIG.rush.speedCurve.accelPerSec", { min: 0 });
      reqObj(rush.spawnInterval, "KR_CONFIG.rush.spawnInterval");
      reqNum(rush.spawnInterval.initialMs, "KR_CONFIG.rush.spawnInterval.initialMs", { min: 1, integer: true });
      reqNum(rush.spawnInterval.decayPerSec, "KR_CONFIG.rush.spawnInterval.decayPerSec", { min: 0 });
      reqNum(rush.spawnInterval.minMs, "KR_CONFIG.rush.spawnInterval.minMs", { min: 1, integer: true });
      reqObj(rush.hitWindow, "KR_CONFIG.rush.hitWindow");
      reqNum(rush.hitWindow.initialMs, "KR_CONFIG.rush.hitWindow.initialMs", { min: 1, integer: true });
      reqNum(rush.hitWindow.decayPerSec, "KR_CONFIG.rush.hitWindow.decayPerSec", { min: 0 });
      reqNum(rush.hitWindow.minMs, "KR_CONFIG.rush.hitWindow.minMs", { min: 1, integer: true });
      reqObj(rush.kitchenShare, "KR_CONFIG.rush.kitchenShare");
      reqNum(rush.kitchenShare.base, "KR_CONFIG.rush.kitchenShare.base", { min: 0, max: 1 });
      reqNum(rush.kitchenShare.growthPerSec, "KR_CONFIG.rush.kitchenShare.growthPerSec", { min: 0 });
      reqNum(rush.kitchenShare.max, "KR_CONFIG.rush.kitchenShare.max", { min: 0, max: 1 });
      if (rush.ballTypes != null) {
        reqObj(rush.ballTypes, "KR_CONFIG.rush.ballTypes");
        Object.keys(rush.ballTypes).forEach((key) => {
          const bt = reqObj(rush.ballTypes[key], "KR_CONFIG.rush.ballTypes." + key);
          reqNum(bt.unlockAfterSec, "KR_CONFIG.rush.ballTypes." + key + ".unlockAfterSec", { min: 0 });
          reqNum(bt.weight, "KR_CONFIG.rush.ballTypes." + key + ".weight", { min: 0 });
          reqNum(bt.speedMultiplier, "KR_CONFIG.rush.ballTypes." + key + ".speedMultiplier", { min: 0.01 });
          reqNum(bt.hitWindowMultiplier, "KR_CONFIG.rush.ballTypes." + key + ".hitWindowMultiplier", { min: 0.01 });
          reqNum(bt.radiusMultiplier, "KR_CONFIG.rush.ballTypes." + key + ".radiusMultiplier", { min: 0.01 });
          reqBool(bt.forceKitchen, "KR_CONFIG.rush.ballTypes." + key + ".forceKitchen");
        });
      }

      const classic = reqObj(cfg.classic, "KR_CONFIG.classic");
      reqNum(classic.targetScore, "KR_CONFIG.classic.targetScore", { min: 1, integer: true });
      reqNum(classic.winBy, "KR_CONFIG.classic.winBy", { min: 1, integer: true });
      reqNum(classic.betweenShotsMs, "KR_CONFIG.classic.betweenShotsMs", { min: 1, integer: true });
      reqNum(classic.betweenRalliesMs, "KR_CONFIG.classic.betweenRalliesMs", { min: 1, integer: true });
      reqNum(classic.opponentReturnBase, "KR_CONFIG.classic.opponentReturnBase", { min: 0, max: 1 });
      reqNum(classic.opponentReturnDecayPerShot, "KR_CONFIG.classic.opponentReturnDecayPerShot", { min: 0, max: 1 });
      reqNum(classic.opponentReturnMin, "KR_CONFIG.classic.opponentReturnMin", { min: 0, max: 1 });
      reqNum(classic.opponentFaultBase, "KR_CONFIG.classic.opponentFaultBase", { min: 0, max: 1 });
      reqNum(classic.opponentFaultMax, "KR_CONFIG.classic.opponentFaultMax", { min: 0, max: 1 });
      reqNum(classic.serveIndicatorMs, "KR_CONFIG.classic.serveIndicatorMs", { min: 1, integer: true });
      reqNum(classic.sideOutIndicatorMs, "KR_CONFIG.classic.sideOutIndicatorMs", { min: 1, integer: true });
      reqBool(classic.playerStartsServing, "KR_CONFIG.classic.playerStartsServing");
      reqNum(classic.preServePauseMs, "KR_CONFIG.classic.preServePauseMs", { min: 1, integer: true });
      reqNum(classic.rallyStartSlowMs, "KR_CONFIG.classic.rallyStartSlowMs", { min: 0, integer: true });
      reqNum(classic.playerReturnWindowBonusMs, "KR_CONFIG.classic.playerReturnWindowBonusMs", { min: 0, integer: true });
      reqBool(classic.rushCarryoverDisabled, "KR_CONFIG.classic.rushCarryoverDisabled");
      reqStr(classic.serviceCourtRightLabel, "KR_CONFIG.classic.serviceCourtRightLabel");
      reqStr(classic.serviceCourtLeftLabel, "KR_CONFIG.classic.serviceCourtLeftLabel");

      const daily = reqObj(cfg.daily, "KR_CONFIG.daily");
      reqBool(daily.enabled, "KR_CONFIG.daily.enabled");
      reqStr(daily.mode, "KR_CONFIG.daily.mode");
      if (daily.mode !== enums.GAME_MODES.RUN) fail("KR_CONFIG.daily.mode must equal KR_ENUMS.GAME_MODES.RUN");

      const canvas = reqObj(cfg.canvas, "KR_CONFIG.canvas");
      reqNum(canvas.kitchenLineY, "KR_CONFIG.canvas.kitchenLineY", { min: 0.01, max: 0.99 });
      reqNum(canvas.netYFrac, "KR_CONFIG.canvas.netYFrac", { min: 0.01, max: 0.99 });
      reqNum(canvas.perspectiveTopInsetFrac, "KR_CONFIG.canvas.perspectiveTopInsetFrac", { min: 0, max: 0.49 });
      reqNum(canvas.perspectiveBottomInsetFrac, "KR_CONFIG.canvas.perspectiveBottomInsetFrac", { min: 0, max: 0.49 });
      reqNum(canvas.playerScaleNear, "KR_CONFIG.canvas.playerScaleNear", { min: 0.1, max: 4 });
      reqNum(canvas.playerScaleFar, "KR_CONFIG.canvas.playerScaleFar", { min: 0.1, max: 4 });
      reqNum(canvas.landingMarkerRadiusPx, "KR_CONFIG.canvas.landingMarkerRadiusPx", { min: 1, integer: true });
      reqNum(canvas.landingMarkerStrokePx, "KR_CONFIG.canvas.landingMarkerStrokePx", { min: 1, integer: true });
      reqNum(canvas.trajectoryGuideDashPx, "KR_CONFIG.canvas.trajectoryGuideDashPx", { min: 1, integer: true });
      reqNum(canvas.devicePixelRatioMax, "KR_CONFIG.canvas.devicePixelRatioMax", { min: 1, max: 4 });
      reqNum(canvas.serviceTargetGlowAlpha, "KR_CONFIG.canvas.serviceTargetGlowAlpha", { min: 0, max: 1 });
      reqNum(canvas.serviceGuideWidthPx, "KR_CONFIG.canvas.serviceGuideWidthPx", { min: 1, integer: true });
      reqNum(canvas.serviceGuideDashPx, "KR_CONFIG.canvas.serviceGuideDashPx", { min: 1, integer: true });
      reqNum(canvas.serviceGuideShowMs, "KR_CONFIG.canvas.serviceGuideShowMs", { min: 1, integer: true });
      reqNum(canvas.opponentDepthFrac, "KR_CONFIG.canvas.opponentDepthFrac", { min: 0.05, max: 0.45 });
      reqNum(canvas.opponentXOffsetFrac, "KR_CONFIG.canvas.opponentXOffsetFrac", { min: 0, max: 0.4 });
      reqNum(canvas.opponentBodyScale, "KR_CONFIG.canvas.opponentBodyScale", { min: 0.2, max: 2 });
      reqNum(canvas.opponentPaddleScale, "KR_CONFIG.canvas.opponentPaddleScale", { min: 0.2, max: 2 });
      reqNum(canvas.devicePixelRatioMax, "KR_CONFIG.canvas.devicePixelRatioMax", { min: 1, max: 4 });
      reqNum(canvas.minLandingYFrac, "KR_CONFIG.canvas.minLandingYFrac", { min: 0, max: 0.99 });
      reqNum(canvas.ballRadius, "KR_CONFIG.canvas.ballRadius", { min: 1, integer: true });
      reqNum(canvas.hitTolerancePx, "KR_CONFIG.canvas.hitTolerancePx", { min: 0, integer: true });
      reqNum(canvas.shadowGrowthFactor, "KR_CONFIG.canvas.shadowGrowthFactor", { min: 0, max: 1 });
      reqNum(canvas.bounceHeight, "KR_CONFIG.canvas.bounceHeight", { min: 0 });
      reqNum(canvas.bounceAnimMs, "KR_CONFIG.canvas.bounceAnimMs", { min: 1, integer: true });
      reqNum(canvas.hitOutMs, "KR_CONFIG.canvas.hitOutMs", { min: 1, integer: true });
      reqNum(canvas.hitOutDistance, "KR_CONFIG.canvas.hitOutDistance", { min: 1 });
      reqNum(canvas.scorePopupMs, "KR_CONFIG.canvas.scorePopupMs", { min: 1, integer: true });

      const controls = reqObj(cfg.controls, "KR_CONFIG.controls");
      reqBool(controls.keyboardEnabled, "KR_CONFIG.controls.keyboardEnabled");
      reqBool(controls.pointerMoveEnabled, "KR_CONFIG.controls.pointerMoveEnabled");
      reqBool(controls.touchButtonsEnabled, "KR_CONFIG.controls.touchButtonsEnabled");
      reqNum(controls.touchNudgeMs, "KR_CONFIG.controls.touchNudgeMs", { min: 1, integer: true });
      reqNum(controls.pointerSmoothing, "KR_CONFIG.controls.pointerSmoothing", { min: 0, max: 1 });
      if (!Array.isArray(controls.leftKeys) || controls.leftKeys.length < 1) fail("KR_CONFIG.controls.leftKeys must be a non-empty array");
      if (!Array.isArray(controls.rightKeys) || controls.rightKeys.length < 1) fail("KR_CONFIG.controls.rightKeys must be a non-empty array");
      if (!Array.isArray(controls.hitKeys) || controls.hitKeys.length < 1) fail("KR_CONFIG.controls.hitKeys must be a non-empty array");

      const limits = reqObj(cfg.limits, "KR_CONFIG.limits");
      reqNum(limits.freeRuns, "KR_CONFIG.limits.freeRuns", { min: 0, integer: true });

      const houseAd = reqObj(cfg.houseAd, "KR_CONFIG.houseAd");
      reqBool(houseAd.enabled, "KR_CONFIG.houseAd.enabled");
      reqIntArray(houseAd.showAfterRunCompletes, "KR_CONFIG.houseAd.showAfterRunCompletes");
      reqNum(houseAd.hideMs, "KR_CONFIG.houseAd.hideMs", { min: 0, integer: true });

      const waitlist = reqObj(cfg.waitlist, "KR_CONFIG.waitlist");
      reqBool(waitlist.enabled, "KR_CONFIG.waitlist.enabled");
      reqIntArray(waitlist.showAfterRunCompletes, "KR_CONFIG.waitlist.showAfterRunCompletes");
      reqStr(waitlist.toEmailObfuscated, "KR_CONFIG.waitlist.toEmailObfuscated");
      reqStr(waitlist.subjectPrefix, "KR_CONFIG.waitlist.subjectPrefix");

      const statsSharing = reqObj(cfg.statsSharing, "KR_CONFIG.statsSharing");
      reqBool(statsSharing.enabled, "KR_CONFIG.statsSharing.enabled");
      reqIntArray(statsSharing.promptAfterRunCompletes, "KR_CONFIG.statsSharing.promptAfterRunCompletes");
      reqStr(statsSharing.emailSubject, "KR_CONFIG.statsSharing.emailSubject");
      reqStr(statsSharing.schemaVersion, "KR_CONFIG.statsSharing.schemaVersion");

      const sprint = reqObj(cfg.sprint, "KR_CONFIG.sprint");
      reqNum(sprint.durationMs, "KR_CONFIG.sprint.durationMs", { min: 1, integer: true });
      reqNum(sprint.faultPenaltyMs, "KR_CONFIG.sprint.faultPenaltyMs", { min: 1, integer: true });
      reqNum(sprint.freeRunsLimit, "KR_CONFIG.sprint.freeRunsLimit", { min: 0, integer: true });

      const audio = reqObj(cfg.audio, "KR_CONFIG.audio");
      reqBool(audio.enabled, "KR_CONFIG.audio.enabled");
      reqNum(audio.hitVolume, "KR_CONFIG.audio.hitVolume", { min: 0, max: 1 });
      reqNum(audio.faultVolume, "KR_CONFIG.audio.faultVolume", { min: 0, max: 1 });
      reqNum(audio.bounceVolume, "KR_CONFIG.audio.bounceVolume", { min: 0, max: 1 });

      const challenges = reqObj(cfg.challenges, "KR_CONFIG.challenges");
      reqNum(challenges.cleanRunMinScore, "KR_CONFIG.challenges.cleanRunMinScore", { min: 1, integer: true });
      reqNum(challenges.streakThreshold, "KR_CONFIG.challenges.streakThreshold", { min: 1, integer: true });
      reqNum(challenges.streakTargetBonus, "KR_CONFIG.challenges.streakTargetBonus", { min: 1, integer: true });
      reqNum(challenges.faultThreshold, "KR_CONFIG.challenges.faultThreshold", { min: 0, integer: true });
      reqNum(challenges.lowAccuracyPct, "KR_CONFIG.challenges.lowAccuracyPct", { min: 0, max: 100, integer: true });
      reqNum(challenges.lowAccuracyMinScore, "KR_CONFIG.challenges.lowAccuracyMinScore", { min: 1, integer: true });

      const juice = reqObj(cfg.juice, "KR_CONFIG.juice");
      reqNum(juice.hitFlashMs, "KR_CONFIG.juice.hitFlashMs", { min: 1, integer: true });
      reqNum(juice.faultFlashMs, "KR_CONFIG.juice.faultFlashMs", { min: 1, integer: true });
      reqNum(juice.faultShakeMs, "KR_CONFIG.juice.faultShakeMs", { min: 1, integer: true });
      reqNum(juice.faultShakeIntensity, "KR_CONFIG.juice.faultShakeIntensity", { min: 0 });
      reqNum(juice.bounceRingMs, "KR_CONFIG.juice.bounceRingMs", { min: 1, integer: true });
      reqNum(juice.sprintPenaltyMs, "KR_CONFIG.juice.sprintPenaltyMs", { min: 1, integer: true });
      reqNum(juice.milestoneGlowMs, "KR_CONFIG.juice.milestoneGlowMs", { min: 1, integer: true });
      reqNum(juice.firstFaultOverlayMs, "KR_CONFIG.juice.firstFaultOverlayMs", { min: 1, integer: true });
      reqNum(juice.repeatFaultOverlayMs, "KR_CONFIG.juice.repeatFaultOverlayMs", { min: 1, integer: true });

      const ui = reqObj(cfg.ui, "KR_CONFIG.ui");
      reqBool(ui.toastDismissOnTap, "KR_CONFIG.ui.toastDismissOnTap");
      reqNum(ui.runStartOverlayMs, "KR_CONFIG.ui.runStartOverlayMs", { min: 1, integer: true });
      reqNum(ui.lifeLostOverlayMs, "KR_CONFIG.ui.lifeLostOverlayMs", { min: 1, integer: true });
      reqNum(ui.gameplayPulseMs, "KR_CONFIG.ui.gameplayPulseMs", { min: 1, integer: true });
      reqNum(ui.endRecordMomentMs, "KR_CONFIG.ui.endRecordMomentMs", { min: 1, integer: true });
      reqNum(ui.paywallTickerMs, "KR_CONFIG.ui.paywallTickerMs", { min: 1, integer: true });
      reqObj(ui.toast, "KR_CONFIG.ui.toast");
      reqObj(ui.toast.default, "KR_CONFIG.ui.toast.default");
      reqNum(ui.toast.default.delayMs, "KR_CONFIG.ui.toast.default.delayMs", { min: 0, integer: true });
      reqNum(ui.toast.default.durationMs, "KR_CONFIG.ui.toast.default.durationMs", { min: 1, integer: true });
      reqObj(ui.toast.positive, "KR_CONFIG.ui.toast.positive");
      reqNum(ui.toast.positive.delayMs, "KR_CONFIG.ui.toast.positive.delayMs", { min: 0, integer: true });
      reqNum(ui.toast.positive.durationMs, "KR_CONFIG.ui.toast.positive.durationMs", { min: 1, integer: true });

      reqStr(cfg.premiumCodeRegex, "KR_CONFIG.premiumCodeRegex");
      try { new RegExp(cfg.premiumCodeRegex); } catch (_) { fail("KR_CONFIG.premiumCodeRegex invalid"); }
      reqCheckoutUrl(cfg.stripeEarlyPaymentUrl, "KR_CONFIG.stripeEarlyPaymentUrl");
      reqCheckoutUrl(cfg.stripeStandardPaymentUrl, "KR_CONFIG.stripeStandardPaymentUrl");
    },

    applyBrandText: function () {
      try {
        const getTrimmedString = (value) => {
          if (value == null) return "";
          return String(value).trim();
        };
        const getNestedString = (root, path) => {
          let cur = root;
          for (const key of path) {
            if (!cur || typeof cur !== "object") throw new Error("KR_CONFIG_BOOT.applyBrandText: missing path segment " + path.join("."));
            cur = cur[key];
          }
          return getTrimmedString(cur);
        };
        const setMetaContent = (selector, value) => {
          const content = getTrimmedString(value);
          if (!content) return;
          const node = document.querySelector(selector);
          if (node) node.setAttribute("content", content);
        };
        const setLinkHref = (selector, value) => {
          const href = getTrimmedString(value);
          if (!href) return;
          const node = document.querySelector(selector);
          if (node) node.setAttribute("href", href);
        };
        const cfg = window.KR_CONFIG;
        const wording = window.KR_WORDING;
        const brandHtml = getNestedString(wording, ["brand", "creatorLineHtml"]);
        const brandText = getNestedString(wording, ["brand", "creatorLine"]);

        if (brandHtml || brandText) {
          document.querySelectorAll('[data-kr-brand="creatorLine"]').forEach((node) => {
            if (!node) return;
            if (brandHtml) node.innerHTML = brandHtml;
            else node.textContent = brandText;
          });
        }

        const version = getTrimmedString(cfg.version);
        const versionPrefix = getNestedString(wording, ["system", "versionPrefix"]);
        if (version) {
          document.querySelectorAll("[data-kr-version]").forEach((node) => {
            if (node) node.textContent = `${versionPrefix}${version}`;
          });
        }

        const tyf = document.getElementById("kr-parent-link");
        const tyfSep = document.querySelector(".kr-footer-sep--parent");
        const parentUrl = getTrimmedString(cfg.identity.parentUrl);

        if (tyf && parentUrl) {
          tyf.setAttribute("href", parentUrl);
          let label = parentUrl;
          try { label = new URL(parentUrl).hostname.replace(/^www\./i, ""); } catch (_) {}
          tyf.textContent = label;
          if (tyfSep) tyfSep.hidden = false;
        } else {
          if (tyf) { tyf.textContent = ""; tyf.removeAttribute("href"); }
          if (tyfSep) tyfSep.hidden = true;
        }

        const seo = (cfg && cfg.seo && typeof cfg.seo === "object") ? cfg.seo : null;
        if (seo) {
          const pageType = getTrimmedString(document.documentElement.getAttribute("data-kr-page"));
          if (!pageType) throw new Error("KR_CONFIG_BOOT.applyBrandText: data-kr-page missing");
          if (pageType === "success") {
            const successTitle = getTrimmedString(seo.successTitle);
            const successDescription = getTrimmedString(seo.successDescription);
            if (successTitle) document.title = successTitle;
            setMetaContent('meta[name="description"]', successDescription);
            setLinkHref('link[rel="canonical"]', seo.canonicalUrl + 'success.html');
          } else {
            const title = getTrimmedString(seo.title);
            const description = getTrimmedString(seo.description);
            if (title) document.title = title;
            setMetaContent('meta[name="description"]', description);
            setMetaContent('meta[name="twitter:title"]', title);
            setMetaContent('meta[name="twitter:description"]', description);
            setMetaContent('meta[name="twitter:url"]', seo.canonicalUrl);
            setMetaContent('meta[name="twitter:image"]', seo.shareImageUrl);
            setMetaContent('meta[property="og:title"]', title);
            setMetaContent('meta[property="og:description"]', description);
            setMetaContent('meta[property="og:url"]', seo.canonicalUrl);
            setMetaContent('meta[property="og:image"]', seo.shareImageUrl);
            setLinkHref('link[rel="canonical"]', seo.canonicalUrl);
          }
          setMetaContent('meta[name="theme-color"]', seo.themeColor);
        }

        const fw = window.KR_WORDING.footer;
        const privacy = document.getElementById("kr-privacy-link");
        const terms = document.getElementById("kr-terms-link");
        if (privacy) privacy.textContent = String(fw.privacy).trim();
        if (terms) terms.textContent = String(fw.terms).trim();

        document.querySelectorAll(".kr-footer-row--links .kr-footer-sep").forEach((sep) => {
          if (!sep) return;
          const prev = sep.previousElementSibling;
          const next = sep.nextElementSibling;
          const prevText = prev ? String(prev.textContent == null ? "" : prev.textContent).trim() : "";
          const nextText = next ? String(next.textContent == null ? "" : next.textContent).trim() : "";
          sep.hidden = !(prevText && nextText);
        });
      } catch (_) { }
    }
  };

})();
