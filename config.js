// config.js v1.0 - Kitchen Rush
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
  window.KR_UTILS = window.KR_UTILS || {};
  window.KR_UTILS.escapeHtml = function (str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

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
    version: "1",

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
      appUrl: "https://kitchenrush.app",   // TBD: confirm domain
      parentUrl: "",

      // UI signature icon (in-card branding)
      uiLogoUrl: "./icons/kr-icon-512x512-rond.png"
    },

    // ============================================
    // STORAGE (single source of truth)
    // ============================================
    storage: {
      storageKey: KR_STORAGE_KEY,
      vanityCodeStorageKey: KR_VANITY_CODE_STORAGE_KEY
    },


    // ============================================
    // GAME — core gameplay mechanics (Canvas)
    // ============================================
    game: {
      // Lives
      lives: 3,

      // Onboarding: first N balls always outside Kitchen
      onboardingShield: 3,

      // Rebound delay (ms) — time between ball landing and bounce signal
      // U5: Increased from 150 to 350 for satisfying Kitchen tension (the "aha" moment)
      reboundDelayMs: 350,

      // Speed curve: speed(t) = base + accelPerSec * t
      speed: {
        base: 2.8,
        accelPerSec: 0.05
      },

      // Spawn interval: spawnInterval(t) = max(minMs, initialMs - decayPerSec * t)
      spawn: {
        initialMs: 1200,
        decayPerSec: 12,
        minMs: 400
      },

      // Tap window: windowMs(t) = max(minMs, initialMs - decayPerSec * t)
      window: {
        initialMs: 350,
        decayPerSec: 2.5,
        minMs: 80
      },

      // Kitchen ratio: kitchenRatio(t) = min(max, base + growthPerSec * t)
      kitchenRatio: {
        base: 0.3,
        growthPerSec: 0.01,
        max: 0.7
      },

      // Milestones (Smash counts triggering visual feedback)
      milestones: [25, 50, 100],

      // Each type unlocks after N seconds elapsed, changing one parameter.
      // "normal" is always available. Types are additive, not replacing.
      ballTypes: {
        // Dink: slow, always Kitchen, large tap window (easy — but must wait)
        dink: {
          unlockAfterSec: 15,
          weight: 0.2,              // spawn probability weight when unlocked
          speedMultiplier: 0.5,
          forceKitchen: true,
          tapWindowMultiplier: 1.8,
          radiusMultiplier: 0.8
        },
        // Lob: high arc, slow, lands anywhere, long float = patience test
        lob: {
          unlockAfterSec: 30,
          weight: 0.15,
          speedMultiplier: 0.35,
          forceKitchen: false,
          tapWindowMultiplier: 0.7,   // shorter window after landing
          radiusMultiplier: 1.3
        },
        // Fast: speed ball, short tap window, never Kitchen (pure reflex)
        fast: {
          unlockAfterSec: 45,
          weight: 0.15,
          speedMultiplier: 2.0,
          forceKitchen: false,
          tapWindowMultiplier: 0.6,
          radiusMultiplier: 0.9
        }
      }
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
      smashFlashMs: 120,
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
    // COURT — V2 game layout (fractions of canvas height)
    // ============================================
    court: {
      // V2 court layout — proportions faithful to USAP 2026 rulebook
      // Real court: 44ft × 20ft. Player's half = 22ft deep.
      // NVZ (kitchen) = 7ft from net = 7/22 ≈ 31.8% of player's half.
      // We show ~12% of opponent's compressed side above the net.
      netY: 0.12,              // net position: 12% from top
      kitchenLineY: 0.39,      // NVZ line: net + 27% ≈ 39% from top
      baselineY: 0.82,         // baseline: 82% from top
      playerY: 0.75,           // player position: service court
      opponentY: 0.06,         // opponent: compressed far side
      controlsY: 0.85,         // touch controls zone start

      // Player movement speed (pixels per frame at 60fps)
      playerSpeed: 4.5,

      // Hit range (max X distance between player and ball to hit)
      hitRange: 55
    },


    // ============================================
    // CANVAS — rendering dimensions & layout
    // ============================================
    canvas: {
      // Internal aspect ratio (portrait)
      aspectRatio: "9:16",

      // Kitchen line position (% from top of court area)
      kitchenLineY: 0.65,

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
      bounceHeight: 0.08,      // fraction of canvas height
      bounceAnimMs: 250,       // duration of bounce animation

      // Smash-out animation: ball flies away after being smashed
      smashOutMs: 300,         // duration of fly-away animation
      smashOutDistance: 200,    // pixels the ball flies upward

      // Score popup: "+1" floats up from smash point
      scorePopupMs: 600,

      // Trail: number of trail segments behind falling ball
      trailSegments: 4,

      // Canvas colors (non-DOM: CSS cannot style canvas content)
      colors: {
        // V2: Court colors (blue-night theme per briefing)
        courtBg: "#0a1628",          // bleu-nuit profond
        kitchenBg: "#2a1a0a",        // rouge-corail sombre (warm zone)
        kitchenLine: "#ff6b4a",      // corail vif — kitchen delimiter
        kitchenLabelColor: "#ff6b4a44",
        netColor: "#e0e0e0",         // blanc/gris clair

        // Player/opponent
        playerColor: "#44ccff",      // cyan — distinct du terrain et kitchen
        playerOutline: "#2288bb",
        opponentColor: "#667788",    // gris-bleu — silhouette discrète

        // Ball
        ballDefault: "#ffd60a",      // jaune vif exclusif (per briefing)
        ballKitchen: "#ffd60a",      // same yellow — kitchen is the ZONE not the ball color
        ballSmashed: "#06d6a0",
        ballFaulted: "#ef476f",
        ballMissed: "#6c757d",
        bounceRing: "#06d6a0",
        shadow: "#000000",

        // Score popup
        scorePopup: "#06d6a0",

        // "WAIT" indicator on kitchen balls
        waitIndicator: "#ff6b4a",

        // V2: Ball type colors
        ballDink: "#98c1d9",
        ballLob: "#e0aaff",
        ballFast: "#ff8800",

        // Court lines
        courtLines: "#ffffff30",

        // V2: UI overlay colors (drawn on canvas)
        netMesh: "rgba(255,255,255,0.15)",
        controlZoneBg: "rgba(255,255,255,0.03)",
        controlZoneBorder: "rgba(255,255,255,0.08)",
        controlZoneHitBorder: "rgba(255,255,255,0.12)",
        controlZoneText: "rgba(255,255,255,0.2)",
        bounceRingFlash: "#06d6a0",
        faultVignetteColor: "239,71,111",
        smashFlashColor: "6,214,160",
        highlightWhite: "rgba(255,255,255,0.4)",
        motionLines: "rgba(255,255,255,0.15)",
        playerGlow: "rgba(68,204,255,0.25)",

        // Milestone tint colors
        milestone1CourtBg: "#0a1a2a",
        milestone1KitchenBg: "#2a1a10",
        milestone2CourtBg: "#1a1a0a",
        milestone2KitchenBg: "#2a1a0f",
        milestone3CourtBg: "#1a0a2a",
        milestone3KitchenBg: "#2a0f1a"
      }
    },


    // ============================================
    // AUDIO
    // ============================================
    audio: {
      enabled: true,
      smashVolume: 0.6,
      faultVolume: 0.4,
      bounceVolume: 0.3
    },


    // ============================================
    // HAPTIC
    // ============================================
    haptic: {
      enabled: true,
      smashPattern: [15],
      faultPattern: [30, 50, 30]
    },


    // ============================================
    // LIMITS — monetization by replayability
    // ============================================
    limits: {
      // U9: Increased from 3 to 5 — let players learn Kitchen before paywall
      freeRuns: 5
    },


    // ============================================
    // CHALLENGES — thresholds for Court Challenges
    // ============================================
    challenges: {
      nearBestGap: 5,         // show "near best" if gap ≤ this
      cleanRunMinSmashes: 5,  // min smashes to celebrate a 0-fault run
      streakThreshold: 8,     // show streak challenge if bestStreak ≥ this
      streakTargetBonus: 3,   // target = streak + this
      faultThreshold: 2,      // show fault coaching if faults ≥ this
      lowAccuracyPct: 60,     // show accuracy challenge if < this %
      lowAccuracyMinSmashes: 3 // min smashes for accuracy to be meaningful
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
    earlyPriceWindowMs: 20 * 60 * 1000, // 20 minutes
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
      enabled: false,            // TBD: enable when other game exists
      premiumOnly: false,
      url: "",                   // TBD: URL to cross-sell game
      showAfterEnd: true,

      // Unlock threshold (completed runs, not pool-based)
      minRunCompletesToShow: 5,

      // "Remind later" hide window (mechanics)
      hideMs: 24 * 60 * 60 * 1000  // 24h
    },

    // ============================================
    // WAITLIST (future products/features notification)
    // ============================================
    waitlist: {
      enabled: false,            // TBD: enable when ready

      // Unlock threshold (completed runs)
      minRunCompletesToShow: 5,

      placement: "end-and-landing-after-seen-once",
      afterPoolExhaustedOnly: false,
      showModalOneShot: false,

      // Obfuscated email (anti-scraping)
      toEmailObfuscated: "",     // TBD
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

      // Milestone triggers (completed runs instead of pool %)
      promptAfterRunCompletes: [3, 5],

      // Also prompt when free runs are exhausted
      promptOnFreeRunsExhausted: true
    },


    // ============================================
    // SUPPORT
    // ============================================
    support: {
      emailObfuscated: "bonjour&#64;kitchenrush&#46;app",
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
        enabled: true,
        pulseBelowMs: 5 * 60 * 1000 // 5 minutes
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
    // MICRO-FEEDBACK (arcade streaks, overlays)
    // ============================================
    microFeedback: {
      // Minimum smashes between consecutive overlays (avoids spam)
      cooldownSmashes: 3,

      // Streak tier thresholds (consecutive smashes without fault)
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
  // - smash, fault, miss
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
      creatorLine: "",                    // TBD
      creatorLineHtml: ""                 // TBD
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
      terms: "Terms"
    },


    success: {
      title: "Payment successful",
      subtitle: "Your activation code is ready. Save it, then activate it in the game.",

      codeLabel: "Your activation code",
      clearDataWarning: "If you clear site data or switch device/browser, you will need this code again.",

      howToActivateTitle: "How to activate",
      howToActivateStep1: "Return to the game.",
      howToActivateStep2Prefix: "Tap",
      howToPlayLabel: "How to play",
      activateWithCodeLabel: "Activate with a code",
      howToActivateStep3Prefix: "Paste your code and tap",
      activateLabel: "Activate",

      whatYouGetTitle: "What you get",
      benefitsTitle: "What you get",
      benefitUnlimitedRuns: "Unlimited runs.",
      benefitSprint: "Sprint mode unlocked.",
      benefitPersonalBest: "Personal best tracking.",

      ctaBackToGame: "Back to game",
      ctaDownload: "Download code (.txt)",
      shortcutHint: "Shortcut: How to play - Activate with a code.",

      thankYouLine: "Thank you for supporting an independent game.",
      supportLabel: "Need help?",

      copyCta: "Copy code",
      copyAgainCta: "Copy code again",
      tipNoRecover: "Tip: keep this code somewhere safe. It can't be recovered from a server.",
      txtTitle: "Your Kitchen Rush activation code",
      txtSaveLine: "Tip: keep this code somewhere safe.",
      txtNoRecoverLine: "It can't be recovered from a server.",

      // Order bump (if enabled in marketing config)
      orderBumpTitle: "",          // TBD: product name
      orderBumpBody: ""            // TBD: product description
    },


    landing: {
      title: "Kitchen Rush",
      tagline: "Fast pickleball arcade.",
      subtitle: "Move to the ball, time your hit, and respect the Kitchen bounce. 3 lives.",

      // Daily challenge badge (shown when daily.enabled)
      dailyBadge: "Daily Challenge",
      dailyDateTemplate: "{month} {day}",
      dailyExplain: "One shared Classic sequence each day. Same run for everyone.",
      classicUnlockHint: "Finish today's Daily to play Classic",
      ctaPlayDaily: "Play Daily Challenge",

      ctaPlay: "Play Classic",
      ctaPlayAfterFirstRun: "Play Classic again",

      bestLabel: "Best",
      bestAriaTemplate: "Personal best: {best} Smashes",
      bestTargetTemplate: "Can you reach {target}?",
      premiumLabel: "Unlimited runs on this device",

      // Landing stats (spark bars)
      runsLabel: "Runs",

      // Lifetime counter (cumulative investment — Eyal Hook model)
      lifetimeTemplate: "{total} lifetime hits",

      // Post-paywall block (LANDING after free runs exhausted)
      postPaywallTitle: "Free runs are used up.",
      postPaywallBody: "Unlock unlimited runs on this device.",
      postPaywallCta: "See options",

      // Post-paywall + secret bonus hint
      postPaywallSbTitle: "Before you decide...",
      postPaywallSbBody: "You've got a secret mode to find. Look for the \uD83C\uDF81."
    },


    ui: {
      livesLabel: "Lives",
      livesAria: "{lives} lives remaining",
      scoreLabel: "",
      scoreAriaTemplate: "Score: {score} Smashes",
      gameOverTitle: "Game over",

      // V2: Canvas in-game labels (drawn on canvas, not DOM)
      kitchenLabel: "KITCHEN",
      waitLabel: "WAIT",
      nowLabel: "NOW!",
      goLabel: "GO!",
      doubleBounceLabel: "LET IT BOUNCE",
      hitLabel: "HIT",
      controlLeftLabel: "\u25C4",
      controlRightLabel: "\u25BA",
      controlMoveLabel: "MOVE",
      controlTimingLabel: "HIT",
      timingPerfectLabel: "PERFECT!",
      timingNiceLabel: "NICE!",

      // Start-of-run overlay (economy)
      startRunTypeFree: "FREE RUN",
      startRunTypeLastFree: "Last free run.",
      startRunTypeUnlimited: "",

      // Chance/life state overlays
      lastLifeOverlay: "Last life.",
      gameOverOverlay: "Game over.",

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
      // Golden Ball (discovery — unlocks Rush/Sprint mode)
      chestAria: "Golden Ball",
      chestHint: "Tap the golden ball to unlock Rush mode.",

      // Modal one-shot (first tap ever)
      modalTitle: "You found Sprint mode",
      modalBody: "20 seconds on the clock. No lives. Every Kitchen fault costs 2 seconds. How many clean hits can you land?",
      modalCta: "Let's rally",

      // Teaser (free runs limit)
      startOverlayFreeRunsLimitLine: "{remaining}/{limit} free sprints left",
      freeLimitReachedTitle: "That was a rally.",
      freeLimitReachedBody: "You've used your {limit} free sprints.\n\nPremium unlocks unlimited Sprint mode.",
      freeLimitReachedCta: "Unlock Sprint",
      freeLimitReachedClose: "Not now",

      // In-game HUD
      title: "Sprint",
      timerLabel: "{remaining}s",
      penaltyFlash: "-2s",

      // Start overlay
      startOverlayLine1: "20 seconds. No lives.",
      startOverlayLine2: "Kitchen faults cost 2 seconds.",
      startOverlayTapAnywhere: "Tap anywhere to go",

      // End screen
      endTitle: "Time!",
      scoreLine: "{score} hits in 20s",
      bestLine: "Sprint best: {best}",
      freeRunsLeftLine: "{remaining}/{limit} free sprints left.",
      newBest: "New sprint record!",
      playAgain: "Sprint again",
      backToRuns: "Back to court",

      // End toast
      endGameOverToast: "Time's up",

      // CTA
      ctaPlayAgain: "Sprint again"
    },


    end: {
      title: "Game over",

      scoreLine: "{score} hits",
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

      shareTitle: "Share"
    },


    firstRun: {
      trustLine: "No ads. No tricks. Just you and the court.",
      kitchenHint: "Kitchen ball (near the net)? Wait for the bounce before you hit.",
      rule1: "Move left/right to reach the ball",
      rule2: "Press HIT when you're in range",
      rule3: "Kitchen zone = wait for the bounce first"
    },


    paywall: {
      headline: "Own the court.",

      headlineLastFree: "That was your last free run.",

      valueTitle: "What you get",
      trustTitle: "No surprises",

      valueBullets: [
        "Unlimited runs — same rules, no cap",
        "Sprint mode — 20 seconds of pure banger energy",
        "Chase your personal best, run after run"
      ],

      bridgeTitle: "Free runs are done.",
      bridgeBody: "Unlock unlimited court time on this device.",

      // Personal progress anchor (shown only if best > 0)
      progressLineTemplate: "Your best: {best} hits. Keep climbing.",

      trustLine: "One purchase. Lifetime access. No tricks.",
      trustBullets: [
        "One-time payment, no subscription",
        "No ads, ever — just you and the court",
        "No signup or account needed",
        "Secure checkout via Stripe"
      ],

      // EARLY-only conversion bump
      savingsLineTemplate: "Save {saveAmount} today (early price).",

      checkoutNote: "Secure checkout via Stripe.",

      ctaEarly: "Unlock at $4.99",
      ctaStandard: "Unlock - $6.99",
      cta: "Unlock",

      alreadyHaveCode: "Already have a code? Redeem it here.",
      deviceNote: "Premium stays unlocked on this device. No account needed.",

      earlyBadgeLabel: "Early bird",
      earlyLabel: "Early price",
      standardLabel: "Standard price",

      timerLabel: "Price increases in:",

      postEarlyLine1: "The early price has ended.",
      postEarlyLine2: "{standardPrice} - One-time purchase. Yours forever.",

      ctaNotNow: "Not now"
    },


    howto: {
      title: "How to play",
      line1: "Balls drop onto the court.",
      line2: "Tap to smash them before they bounce away.",
      line3: "But if a ball lands in the Kitchen — wait for the bounce first.",

      ruleTitle: "The Kitchen rule",
      ruleSentence: "The Kitchen is the non-volley zone near the net. No smashing before the bounce. Tap too early = fault = life lost.",

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
      templateDefault: "Kitchen Rush \u2014 {score} Smashes {hashtag}\nCan you beat that?\n{url}",
      templateFault: "Kitchen Rush \u2014 {score} Smashes {hashtag}\nThe Kitchen got me. Your turn.\n{url}",
      templateNewBest: "Kitchen Rush \u2014 NEW BEST: {score} Smashes {hashtag}\nCome get me.\n{url}",
      templateSprint: "Kitchen Rush Rush \u2014 {score} in 20s {hashtag}\nPure speed. Beat that.\n{url}",
      templateDaily: "Kitchen Rush Daily ({date}) {modifier}\n{score} Smashes | Streak {streak} {hashtag}\nSame challenge for everyone. Can you beat {score}?\n{url}",

      // Hashtag (dynamic: #KitchenRush{score})
      hashtagPrefix: "#KitchenRush",

      // Share card modal (auto-shown after new best)
      cardModalTitle: "New personal best!",

      // V2: Share card labels (canvas image)
      cardSprintLabel: "Sprint Mode",
      cardDailyLabel: "Daily Challenge",
      cardSmashesLabel: "Hits",
      cardBestLabel: "Best: {best}",
      cardDateFormat: "{month} {day}, {year}",
      cardTagline: "kitchenrush.app"
    },


    installPrompt: {
      title: "Install Kitchen Rush",
      body: "Play instantly. Read the bounce, protect your lives, and jump back in fast. On iPhone: Share > Add to Home Screen.",
      ctaPrimary: "Add to home screen",
      ctaSecondary: "Later"
    },


    houseAd: {
      eyebrow: "",
      title: "",
      bodyLine1: "Kitchen Rush is a standalone arcade game.",
      bodyLine2: "We have other games.",
      ctaPrimary: "Try another game",
      ctaRemindLater: "Remind later",

      landingTitle: "",
      landingBodyLine1: "",
      landingBodyLine2: "",
      landingCtaPrimary: "Try another game",
      landingCtaRemindLater: "Remind later"
    },


    waitlist: {
      ctaLabel: "Get notified about future products or features.",
      disclaimer: "No spam. No account. You can leave anytime.",
      title: "Get notified about future products or features.",
      bodyLine1: "No spam. No account. Leave anytime.",
      bodyLine2: "Optional: reply with one idea if you want.",
      inputPlaceholder: "Optional: share an idea.",
      cta: "Send email",

      emailSubjectSuffix: "Waitlist",
      emailBodyTemplate: "Hi!\n\nI'd like to join the Kitchen Rush waitlist.\n\nOptional idea:\n{idea}\n\nThanks!"
    },


    statsSharing: {
      sectionTitle: "Anonymous stats (optional)",
      buttonLabel: "Share anonymous stats",

      promptTitle: "Help improve Kitchen Rush",
      promptBodyTemplate: "You've completed {runCompletes} runs. Share anonymous stats to help improve the game. You can review everything before sending.",
      promptBodyLastFree: "That was your last free run. Share anonymous stats to help improve the game. You can review everything before sending.",
      promptCtaPrimary: "Preview & share",
      promptCtaSecondary: "Not now",

      modalTitle: "Help improve the game",
      modalDescription: "Share your anonymous gameplay stats with the creator. No personal data is collected - you can see exactly what will be sent below.",
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
      modalTitle: "Write us",
      modalBodyLine1: "Email is the fastest way to reach us.",
      modalBodyLine2: "Copy the address below or open your email app.",
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
      streakElite: "15 clean - banger rally",
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
      if (!cfg || typeof cfg !== "object") return;

      const warn = (...args) => {
        if (cfg.debug && cfg.debug.enabled) console.warn("[KR_CONFIG]", ...args);
      };

      try { new RegExp(cfg.premiumCodeRegex); } catch (e) { warn("premiumCodeRegex is invalid", e); }

      const appUrl = String((cfg.identity && cfg.identity.appUrl) || "").trim();
      if (!appUrl) warn("identity.appUrl is missing (used for share URL)");
      else if (!/^https?:\/\//i.test(appUrl)) warn("identity.appUrl must start with http:// or https://", appUrl);

      if (!cfg.stripeEarlyPaymentUrl || String(cfg.stripeEarlyPaymentUrl).includes("REPLACE")) warn("Stripe early URL needs to be configured");
      if (!cfg.stripeStandardPaymentUrl || String(cfg.stripeStandardPaymentUrl).includes("REPLACE")) warn("Stripe standard URL needs to be configured");

      if (!cfg.game || !Number.isFinite(Number(cfg.game.lives)) || Number(cfg.game.lives) <= 0) warn("game.lives must be > 0");

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
      reqNum(game.lives, "KR_CONFIG.game.lives", { min: 1, integer: true });
      reqNum(game.onboardingShield, "KR_CONFIG.game.onboardingShield", { min: 0, integer: true });
      reqNum(game.reboundDelayMs, "KR_CONFIG.game.reboundDelayMs", { min: 1, integer: true });
      reqObj(game.speed, "KR_CONFIG.game.speed");
      reqNum(game.speed.base, "KR_CONFIG.game.speed.base", { min: 0.1 });
      reqNum(game.speed.accelPerSec, "KR_CONFIG.game.speed.accelPerSec", { min: 0 });
      reqObj(game.spawn, "KR_CONFIG.game.spawn");
      reqNum(game.spawn.initialMs, "KR_CONFIG.game.spawn.initialMs", { min: 1, integer: true });
      reqNum(game.spawn.decayPerSec, "KR_CONFIG.game.spawn.decayPerSec", { min: 0 });
      reqNum(game.spawn.minMs, "KR_CONFIG.game.spawn.minMs", { min: 1, integer: true });
      reqObj(game.window, "KR_CONFIG.game.window");
      reqNum(game.window.initialMs, "KR_CONFIG.game.window.initialMs", { min: 1, integer: true });
      reqNum(game.window.decayPerSec, "KR_CONFIG.game.window.decayPerSec", { min: 0 });
      reqNum(game.window.minMs, "KR_CONFIG.game.window.minMs", { min: 1, integer: true });
      reqObj(game.kitchenRatio, "KR_CONFIG.game.kitchenRatio");
      reqNum(game.kitchenRatio.base, "KR_CONFIG.game.kitchenRatio.base", { min: 0, max: 1 });
      reqNum(game.kitchenRatio.growthPerSec, "KR_CONFIG.game.kitchenRatio.growthPerSec", { min: 0 });
      reqNum(game.kitchenRatio.max, "KR_CONFIG.game.kitchenRatio.max", { min: 0, max: 1 });
      if (game.ballTypes != null) {
        reqObj(game.ballTypes, "KR_CONFIG.game.ballTypes");
        Object.keys(game.ballTypes).forEach((key) => {
          const bt = reqObj(game.ballTypes[key], "KR_CONFIG.game.ballTypes." + key);
          reqNum(bt.unlockAfterSec, "KR_CONFIG.game.ballTypes." + key + ".unlockAfterSec", { min: 0 });
          reqNum(bt.weight, "KR_CONFIG.game.ballTypes." + key + ".weight", { min: 0 });
          reqNum(bt.speedMultiplier, "KR_CONFIG.game.ballTypes." + key + ".speedMultiplier", { min: 0.01 });
          reqNum(bt.tapWindowMultiplier, "KR_CONFIG.game.ballTypes." + key + ".tapWindowMultiplier", { min: 0.01 });
          reqNum(bt.radiusMultiplier, "KR_CONFIG.game.ballTypes." + key + ".radiusMultiplier", { min: 0.01 });
          reqBool(bt.forceKitchen, "KR_CONFIG.game.ballTypes." + key + ".forceKitchen");
        });
      }

      const daily = reqObj(cfg.daily, "KR_CONFIG.daily");
      reqBool(daily.enabled, "KR_CONFIG.daily.enabled");
      reqStr(daily.mode, "KR_CONFIG.daily.mode");
      if (daily.mode !== enums.GAME_MODES.RUN) fail("KR_CONFIG.daily.mode must equal KR_ENUMS.GAME_MODES.RUN");

      const canvas = reqObj(cfg.canvas, "KR_CONFIG.canvas");
      reqNum(canvas.kitchenLineY, "KR_CONFIG.canvas.kitchenLineY", { min: 0.01, max: 0.99 });
      reqNum(canvas.minLandingYFrac, "KR_CONFIG.canvas.minLandingYFrac", { min: 0, max: 0.99 });
      reqNum(canvas.ballRadius, "KR_CONFIG.canvas.ballRadius", { min: 1, integer: true });
      reqNum(canvas.hitTolerancePx, "KR_CONFIG.canvas.hitTolerancePx", { min: 0, integer: true });
      reqNum(canvas.shadowGrowthFactor, "KR_CONFIG.canvas.shadowGrowthFactor", { min: 0, max: 1 });
      reqNum(canvas.bounceHeight, "KR_CONFIG.canvas.bounceHeight", { min: 0 });
      reqNum(canvas.bounceAnimMs, "KR_CONFIG.canvas.bounceAnimMs", { min: 1, integer: true });
      reqNum(canvas.smashOutMs, "KR_CONFIG.canvas.smashOutMs", { min: 1, integer: true });
      reqNum(canvas.smashOutDistance, "KR_CONFIG.canvas.smashOutDistance", { min: 1 });
      reqNum(canvas.scorePopupMs, "KR_CONFIG.canvas.scorePopupMs", { min: 1, integer: true });

      // V2: Court layout validation (USAP-faithful proportions)
      const court = reqObj(cfg.court, "KR_CONFIG.court");
      reqNum(court.netY, "KR_CONFIG.court.netY", { min: 0.05, max: 0.3 });
      reqNum(court.kitchenLineY, "KR_CONFIG.court.kitchenLineY", { min: 0.2, max: 0.6 });
      reqNum(court.baselineY, "KR_CONFIG.court.baselineY", { min: 0.7, max: 0.95 });
      reqNum(court.playerY, "KR_CONFIG.court.playerY", { min: 0.5, max: 0.9 });
      reqNum(court.opponentY, "KR_CONFIG.court.opponentY", { min: 0.02, max: 0.2 });
      reqNum(court.controlsY, "KR_CONFIG.court.controlsY", { min: 0.8, max: 1.0 });
      reqNum(court.playerSpeed, "KR_CONFIG.court.playerSpeed", { min: 0.1 });
      reqNum(court.hitRange, "KR_CONFIG.court.hitRange", { min: 1 });

      const limits = reqObj(cfg.limits, "KR_CONFIG.limits");
      reqNum(limits.freeRuns, "KR_CONFIG.limits.freeRuns", { min: 0, integer: true });

      const sprint = reqObj(cfg.sprint, "KR_CONFIG.sprint");
      reqNum(sprint.durationMs, "KR_CONFIG.sprint.durationMs", { min: 1, integer: true });
      reqNum(sprint.faultPenaltyMs, "KR_CONFIG.sprint.faultPenaltyMs", { min: 1, integer: true });
      reqNum(sprint.freeRunsLimit, "KR_CONFIG.sprint.freeRunsLimit", { min: 0, integer: true });

      const audio = reqObj(cfg.audio, "KR_CONFIG.audio");
      reqBool(audio.enabled, "KR_CONFIG.audio.enabled");
      reqNum(audio.smashVolume, "KR_CONFIG.audio.smashVolume", { min: 0, max: 1 });
      reqNum(audio.faultVolume, "KR_CONFIG.audio.faultVolume", { min: 0, max: 1 });
      reqNum(audio.bounceVolume, "KR_CONFIG.audio.bounceVolume", { min: 0, max: 1 });

      const challenges = reqObj(cfg.challenges, "KR_CONFIG.challenges");
      reqNum(challenges.cleanRunMinSmashes, "KR_CONFIG.challenges.cleanRunMinSmashes", { min: 1, integer: true });
      reqNum(challenges.streakThreshold, "KR_CONFIG.challenges.streakThreshold", { min: 1, integer: true });
      reqNum(challenges.streakTargetBonus, "KR_CONFIG.challenges.streakTargetBonus", { min: 1, integer: true });
      reqNum(challenges.faultThreshold, "KR_CONFIG.challenges.faultThreshold", { min: 0, integer: true });
      reqNum(challenges.lowAccuracyPct, "KR_CONFIG.challenges.lowAccuracyPct", { min: 0, max: 100, integer: true });
      reqNum(challenges.lowAccuracyMinSmashes, "KR_CONFIG.challenges.lowAccuracyMinSmashes", { min: 1, integer: true });

      const juice = reqObj(cfg.juice, "KR_CONFIG.juice");
      reqNum(juice.smashFlashMs, "KR_CONFIG.juice.smashFlashMs", { min: 1, integer: true });
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
      reqStr(cfg.stripeEarlyPaymentUrl, "KR_CONFIG.stripeEarlyPaymentUrl");
      reqStr(cfg.stripeStandardPaymentUrl, "KR_CONFIG.stripeStandardPaymentUrl");
    },

    applyBrandText: function () {
      try {
        const brandHtml = String((window.KR_WORDING && window.KR_WORDING.brand && window.KR_WORDING.brand.creatorLineHtml) || "").trim();
        const brandText = String((window.KR_WORDING && window.KR_WORDING.brand && window.KR_WORDING.brand.creatorLine) || "").trim();

        if (brandHtml || brandText) {
          document.querySelectorAll('[data-kr-brand="creatorLine"]').forEach((node) => {
            if (!node) return;
            if (brandHtml) node.innerHTML = brandHtml;
            else node.textContent = brandText;
          });
        }

        const version = String(window.KR_CONFIG?.version || "").trim();
        const versionPrefix = String(window.KR_WORDING?.system?.versionPrefix || "").trim();
        if (version) {
          document.querySelectorAll("[data-kr-version]").forEach((node) => {
            if (node) node.textContent = `${versionPrefix}${version}`;
          });
        }

        const tyf = document.getElementById("kr-parent-link");
        const tyfSep = document.querySelector(".kr-footer-sep--parent");
        const parentUrl = String(window.KR_CONFIG?.identity?.parentUrl || "").trim();

        if (tyf && parentUrl) {
          tyf.setAttribute("href", parentUrl);
          let label = parentUrl;
          try { label = new URL(parentUrl).hostname.replace(/^www\./i, ""); } catch (_) { }
          tyf.textContent = label;
          if (tyfSep) tyfSep.style.display = "";
        } else {
          if (tyf) { tyf.textContent = ""; tyf.removeAttribute("href"); }
          if (tyfSep) tyfSep.style.display = "none";
        }

        const fw = window.KR_WORDING?.footer || {};
        const privacy = document.getElementById("kr-privacy-link");
        const terms = document.getElementById("kr-terms-link");
        if (privacy) privacy.textContent = String(fw.privacy || "").trim();
        if (terms) terms.textContent = String(fw.terms || "").trim();

        document.querySelectorAll(".kr-footer-row--links .kr-footer-sep").forEach((sep) => {
          if (!sep) return;
          const prev = sep.previousElementSibling;
          const next = sep.nextElementSibling;
          const prevText = prev ? String(prev.textContent || "").trim() : "";
          const nextText = next ? String(next.textContent || "").trim() : "";
          sep.style.display = (prevText && nextText) ? "" : "none";
        });
      } catch (_) { }
    }
  };

})();
