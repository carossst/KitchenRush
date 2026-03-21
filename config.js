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
  window.KR_UTILS.getUtcDateParts = function (date) {
    var d = (date instanceof Date) ? date : new Date();
    return {
      monthIndex: d.getUTCMonth(),
      day: d.getUTCDate(),
      year: d.getUTCFullYear()
    };
  };
  window.KR_UTILS.getUtcDisplayDateParts = function (wording, date) {
    var parts = window.KR_UTILS.getUtcDateParts(date);
    var monthNames = (wording && wording.system && Array.isArray(wording.system.monthsShort))
      ? wording.system.monthsShort
      : [];
    return {
      month: String(monthNames[parts.monthIndex] || "").trim(),
      day: parts.day,
      year: parts.year
    };
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
    version: "3",

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
      onboardingShield: 5,

      // Rebound delay (ms) — time between ball landing and bounce signal
      // U5: Increased from 150 to 350 for satisfying Kitchen tension (the "aha" moment)
      reboundDelayMs: 420,

      timing: {
        niceThreshold: 0.5,
        perfectThreshold: 0.7,
        sweetSpot: 0.3,
        falloffWindow: 0.5,
        autoHitGraceFrac: 0.4,
        minBounceVisibleMs: 140,
        basePoints: 1,
        perfectPoints: 2
      },

      // Speed curve: speed(t) = base + accelPerSec * t
      speed: {
        base: 2.45,
        accelPerSec: 0.04
      },

      // Spawn interval: spawnInterval(t) = max(minMs, initialMs - decayPerSec * t)
      spawn: {
        initialMs: 1350,
        decayPerSec: 10,
        minMs: 480
      },

      // Tap window: windowMs(t) = max(minMs, initialMs - decayPerSec * t)
      window: {
        initialMs: 440,
        decayPerSec: 1.8,
        minMs: 110
      },

      // Kitchen ratio: kitchenRatio(t) = min(max, base + growthPerSec * t)
      kitchenRatio: {
        base: 0.18,
        growthPerSec: 0.007,
        max: 0.55
      },

      // Trajectory tuning: keep flights readable on mobile without changing architecture
      trajectory: {
        lateralSpreadFrac: 0.28,
        edgeMarginFrac: 0.1,
        arcMinFrac: 0.032,
        arcMaxFrac: 0.16,
        arcDepthWeight: 0.5,
        descentPower: 1.1,
        returnArcScale: 0.82,
        returnTravelScale: 0.88,
        bounceForwardCarryFrac: 0.18,
        bounceLateralCarryFrac: 0.12,
        bounceCarryEase: 2.1,
        bounceSecondHopTimeFrac: 0.52,
        bounceRestitution: 0.34,
        bounceFriction: 4.8,
        bounceSecondHopMomentum: 0.58
      },

      // Opening serve tuning: first incoming ball should read like a real diagonal serve.
      service: {
        centerMarginFrac: 0.06,
        sidelineMarginFrac: 0.1,
        depthMinFrac: 0.18,
        depthMaxFrac: 0.68
      },

      // Milestones (Smash counts triggering visual feedback)
      milestones: [25, 50, 100],

      // Each type unlocks after N seconds elapsed, changing one parameter.
      // "normal" is always available. Types are additive, not replacing.
      ballTypes: {
        // Dink: slow, always Kitchen, large tap window (easy — but must wait)
        dink: {
          unlockAfterSec: 18,
          unlockAfterScore: 3,
          weight: 0.2,              // spawn probability weight when unlocked
          weightGrowthPerSec: 0.0005,
          weightGrowthPerScore: 0.012,
          speedMultiplier: 0.5,
          forceKitchen: true,
          tapWindowMultiplier: 1.8,
          radiusMultiplier: 0.84,
          arcHeightMultiplier: 0.9,
          bounceHeightMultiplier: 0.72,
          reboundDelayMultiplier: 1.05
        },
        // Lob: high arc, slow, lands anywhere, long float = patience test
        lob: {
          unlockAfterSec: 34,
          unlockAfterScore: 6,
          weight: 0.15,
          weightGrowthPerSec: 0.0009,
          weightGrowthPerScore: 0.01,
          speedMultiplier: 0.35,
          forceKitchen: false,
          tapWindowMultiplier: 0.85,
          radiusMultiplier: 1.18,
          arcHeightMultiplier: 1.18,
          bounceHeightMultiplier: 1.05,
          reboundDelayMultiplier: 1.06
        },
        // Fast: speed ball, short tap window, never Kitchen (pure reflex)
        fast: {
          unlockAfterSec: 55,
          unlockAfterScore: 10,
          weight: 0.15,
          weightGrowthPerSec: 0.0012,
          weightGrowthPerScore: 0.012,
          speedMultiplier: 1.58,
          forceKitchen: false,
          tapWindowMultiplier: 0.76,
          radiusMultiplier: 0.9,
          arcHeightMultiplier: 0.86,
          bounceHeightMultiplier: 0.95,
          reboundDelayMultiplier: 0.9
        },
        // Skid: flat, fast, low bounce. Reads like a skidding drive in frontal view.
        skid: {
          unlockAfterSec: 68,
          unlockAfterScore: 14,
          weight: 0.12,
          weightGrowthPerSec: 0.0016,
          weightGrowthPerScore: 0.014,
          speedMultiplier: 1.18,
          forceKitchen: false,
          tapWindowMultiplier: 0.82,
          radiusMultiplier: 0.92,
          arcHeightMultiplier: 0.72,
          bounceHeightMultiplier: 0.54,
          reboundDelayMultiplier: 0.88
        },
        // Heavy: fuller body, deeper ball, shorter read but more physical bounce.
        heavy: {
          unlockAfterSec: 82,
          unlockAfterScore: 18,
          weight: 0.1,
          weightGrowthPerSec: 0.0018,
          weightGrowthPerScore: 0.015,
          speedMultiplier: 1.0,
          forceKitchen: false,
          tapWindowMultiplier: 0.9,
          radiusMultiplier: 1.12,
          arcHeightMultiplier: 0.9,
          bounceHeightMultiplier: 0.78,
          reboundDelayMultiplier: 0.98
        }
      },

      // True power-ups: live gameplay layer.
      // Triggered by readable power balls / rally events.
      // Progression stays fully config-driven here.
      powerUps: {
        enabled: true,
        progression: {
          firstUnlockScore: 12,
          unlockEveryScore: 8,
          maxActiveAtOnce: 1
        },
        weekly: {
          enabled: true,
          weightMultiplier: 1.9,
          cycle: ["shield", "speedBoost", "perfectWindow", "smashBoost", "extraLife"]
        },
        extraLife: {
          enabled: true,
          unlockAfterScore: 18,
          requireRunCompletes: 4,
          requireBestScore: 10,
          requireLifetimeSmashes: 40,
          weight: 0.06,
          triggerBallType: "heavy",
          maxPerRun: 1
        },
        shield: {
          enabled: true,
          unlockAfterScore: 14,
          requireRunCompletes: 2,
          requireBestScore: 6,
          requireLifetimeSmashes: 12,
          weight: 0.12,
          triggerBallType: "dink",
          blockCount: 1,
          durationMs: 0
        },
        speedBoost: {
          enabled: true,
          unlockAfterScore: 22,
          requireRunCompletes: 5,
          requireBestScore: 12,
          requireLifetimeSmashes: 60,
          weight: 0.1,
          triggerBallType: "fast",
          durationMs: 5000,
          moveSpeedMultiplier: 1.22
        },
        perfectWindow: {
          enabled: true,
          unlockAfterScore: 26,
          requireRunCompletes: 7,
          requireBestScore: 16,
          requireLifetimeSmashes: 100,
          weight: 0.08,
          triggerBallType: "lob",
          durationMs: 4500,
          tapWindowMultiplier: 1.18
        },
        smashBoost: {
          enabled: true,
          unlockAfterScore: 30,
          requireRunCompletes: 9,
          requireBestScore: 20,
          requireLifetimeSmashes: 160,
          weight: 0.08,
          triggerBallType: "skid",
          durationMs: 4500,
          scoreMultiplier: 2
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
      sprintSuccessPulseMs: 240,
      milestoneGlowMs: 600,
      firstFaultOverlayMs: 1400,
      repeatFaultOverlayMs: 800
    },

    // ============================================
    // RENDER PERFORMANCE — adaptive quality for mobile browsers
    // ============================================
    renderPerformance: {
      enabled: true,
      sampleFrames: 24,
      downgradeAvgFrameMs: 19.5,
      upgradeAvgFrameMs: 17.2,
      cooldownMs: 1200,
      lowQualityTrailSegments: 1,
      minQualityTrailSegments: 0,
      lowQualityDustCount: 2,
      minQualityDustCount: 0,
      lowQualityNetMeshRows: 2,
      minQualityNetMeshRows: 1,
      lowQualityNetHighlightWidth: 5,
      minQualityNetHighlightWidth: 0,
      hideSpecialBallBadgesAtTier: 1,
      hideReturnTrailAtTier: 1,
      hideSprintSuccessPulseAtTier: 1,
      hideScoreTimingLabelAtTier: 1
    },


    // ============================================
    // COURT — V2 game layout (fractions of canvas height)
    // ============================================
    court: {
      // Frontal broadcast layout based on official pickleball dimensions:
      // Full court: 44ft x 20ft. Each half = 22ft deep.
      // Kitchen = 7ft from net on each side = 7/22 = 31.8% of a half-court.
      // Backcourt = 15ft = 68.2% of a half-court.
      // With netY=0.40 and baselineY=0.88, the exact kitchen line is:
      // 0.40 + (0.88 - 0.40) * (7 / 22) = 0.5527
      netY: 0.40,
      kitchenLineY: 0.553,
      baselineY: 0.88,
      playerY: 0.78,
      opponentY: 0.22,
      controlsY: 0.90,

      // Player movement speed (pixels per frame at 60fps)
      playerSpeed: 4.55,

      // Desktop mouse-follow dead zone in canvas pixels
      desktopMouseDeadZonePx: 8,

      // Hit range (max X distance between player and ball to hit)
      hitRange: 56,
      hitRangeNearScale: 1.08,
      hitRangeFarScale: 0.92
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
      ballRadius: 11,

      // Frontal court rendering
      opponentCourtScale: 0.84,
      cameraPerspectivePower: 1.12,
      sidelineInsetFrac: 0.08,
      nearSidelineInsetFrac: 0.04,
      netSidelineInsetFrac: 0.09,
      farSidelineInsetFrac: 0.14,
      kitchenLineWidth: 4,
      baselineLineWidth: 3,
      sidelineLineWidth: 2.5,
      centerLineWidth: 1.5,
      netCenterSagPx: 4,
      netPostHeightPx: 34,
      netLineWidth: 4,
      netBandDepthPx: 12,
      netMeshRows: 4,
      netMeshColGapPx: 16,
      netNearHighlightThresholdPx: 20,
      netNearHighlightWidth: 8,

      // Hit tolerance (pixels) — tap doesn't need pixel-perfect precision
      hitTolerancePx: 50,

      // Tap anywhere: if true, tap hits the closest active ball regardless of position
      tapAnywhere: true,

      // Shadow growth factor (0..1 range relative to ball y-position)
      shadowGrowthFactor: 0.7,
      shadowMinScale: 0.34,
      shadowMaxScale: 1.04,
      landingMarkerRadiusPx: 18,
      landingMarkerPulseMs: 700,
      serveLabelMs: 900,
      specialBallBadgeMs: 1050,
      ballOutlineWidth: 2,
      ballGlowScale: 1.38,
      ballDepthScaleNear: 0.82,
      ballDepthScaleFar: 0.5,
      ballHeightScaleNear: 0.78,
      ballHeightScaleFar: 0.52,
      playerDepthScaleNear: 1.08,
      playerDepthScaleFar: 1.22,
      views: {
        defaultView: "broadcast",
        broadcast: {
          opponentCourtScale: 0.84,
          cameraPerspectivePower: 1.12,
          opponentPerspectivePower: 1,
          nearSidelineInsetFrac: 0.04,
          netSidelineInsetFrac: 0.09,
          farSidelineInsetFrac: 0.14,
          farCourtAlpha: 0.96,
          opponentKitchenAlpha: 0.95,
          serviceBoxFarAlpha: 0.95,
          ballDepthScaleNear: 0.82,
          ballDepthScaleFar: 0.48,
          ballHeightScaleNear: 0.78,
          ballHeightScaleFar: 0.5
        },
        player: {
          opponentCourtScale: 0.78,
          cameraPerspectivePower: 1.18,
          opponentPerspectivePower: 1,
          nearSidelineInsetFrac: 0.03,
          netSidelineInsetFrac: 0.1,
          farSidelineInsetFrac: 0.16,
          farCourtAlpha: 0.76,
          opponentKitchenAlpha: 0.66,
          serviceBoxFarAlpha: 0.62,
          ballDepthScaleNear: 0.8,
          ballDepthScaleFar: 0.42,
          ballHeightScaleNear: 0.82,
          ballHeightScaleFar: 0.42
        }
      },
      playerOutlineWidth: 1.5,
      opponentOutlineWidth: 1.8,
      actorIdleBreathePx: 0.8,
      playerRunLeanPx: 3.5,
      playerSwingArcScale: 1.15,
      playerForehandTwistPx: 3.5,
      playerBackhandTwistPx: 6.5,
      playerStanceWidthPx: 4.5,
      opponentReadyOffsetPx: 1.8,
      opponentSwingArcScale: 1.1,
      opponentForehandTwistPx: 2.6,
      opponentBackhandTwistPx: 4.4,
      opponentStanceWidthPx: 3.6,
      playerPaddleWidthPx: 4,
      playerPaddleHeightPx: 13,
      playerPaddleCornerPx: 2,
      playerPaddleReachPx: 13,
      opponentPaddleWidthPx: 3,
      opponentPaddleHeightPx: 10,
      opponentPaddleCornerPx: 2,
      opponentPaddleReachPx: 9,
      impactDustCount: 4,
      trajectoryTrailSegments: 3,
      trajectoryTrailAlpha: 0.16,
      controlZoneInsetPx: 4,
      controlZoneFontFrac: 0.019,
      controlZoneLabelYFrac: 0.64,
      bounceSecondHopScale: 0.22,
      bounceSquashMaxFrac: 0.22,

      // Bounce animation: ball jumps up visually after landing
      bounceHeight: 0.068,      // fraction of canvas height
      bounceAnimMs: 280,       // duration of bounce animation

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
        courtFarBg: "#102233",
        courtNearBg: "#173f2c",
        kitchenBg: "#2a1a0a",        // rouge-corail sombre (warm zone)
        opponentKitchenBg: "rgba(255,124,74,0.2)",
        kitchenLine: "#ff6b4a",      // corail vif — kitchen delimiter
        kitchenLabelColor: "#ff6b4a44",
        netColor: "#e0e0e0",         // blanc/gris clair
        opponentKitchenOverlay: "rgba(255,255,255,0.05)",
        serviceBoxTint: "rgba(255,255,255,0.05)",
        serviceBoxTintFar: "rgba(255,255,255,0.09)",

        // Player/opponent
        playerColor: "#44ccff",      // cyan — distinct du terrain et kitchen
        playerOutline: "#2288bb",
        opponentColor: "#667788",    // legacy
        opponentFill: "#90a9bf",
        opponentOutline: "#d8e4ef",
        opponentRacket: "#f0f5f9",
        opponentShadow: "rgba(0,0,0,0.18)",
        trajectoryTrail: "rgba(255,255,255,0.18)",
        returnTrail: "rgba(6,214,160,0.22)",

        // Ball
        ballDefault: "#ffd60a",      // jaune vif exclusif (per briefing)
        ballKitchen: "#ffd60a",      // same yellow — kitchen is the ZONE not the ball color
        ballOutline: "#071926",
        ballSmashed: "#06d6a0",
        ballFaulted: "#ef476f",
        ballMissed: "#6c757d",
        bounceRing: "#06d6a0",
        shadow: "#000000",
        powerBadgeBg: "rgba(8,18,28,0.8)",

        // Score popup
        scorePopup: "#06d6a0",

        // "WAIT" indicator on kitchen balls
        waitIndicator: "#ff6b4a",
        powerUpReady: "#9bffb0",
        powerUpShield: "#80ed99",
        powerUpSpeed: "#5ec8ff",
        powerUpPerfect: "#c9a6ff",
        powerUpSmash: "#ffd166",
        powerUpLife: "#ff8fa3",
        weeklyFeatured: "#f4a261",

        // V2: Ball type colors
        ballDink: "#98c1d9",
        ballLob: "#e0aaff",
        ballFast: "#ff8800",
        ballSkid: "#ff5d8f",
        ballHeavy: "#ffd166",

        // Court lines
        courtLines: "#ffffff40",
        courtLinesStrong: "#ffffff8f",
        courtLinesSoft: "#ffffff46",
        centerLine: "#ffffff66",

        // V2: UI overlay colors (drawn on canvas)
        netMesh: "rgba(255,255,255,0.14)",
        controlZoneBg: "rgba(255,255,255,0.012)",
        controlZoneBorder: "rgba(255,255,255,0.03)",
        controlZoneHitBorder: "rgba(255,255,255,0.05)",
        controlZoneText: "rgba(255,255,255,0.1)",
        bounceRingFlash: "#06d6a0",
        faultVignetteColor: "239,71,111",
        smashFlashColor: "6,214,160",
        whiteRgb: "255,255,255",
        shadowRgb: "0,0,0",
        goldRgb: "255,215,0",
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
      lowAccuracyMinSmashes: 3, // min smashes for accuracy to be meaningful
      improvedAccuracyMinGainPct: 8,
      fewerFaultsMinDelta: 1,
      betterStreakMinDelta: 2
    },

    // ============================================
    // END SCREEN
    // ============================================
    end: {
      bestStreakLineMin: 3,
      almostBestGapMax: 10,
      playAgainNearBestGapMax: 5
    },

    // ============================================
    // HISTORY / PERSONAL BEST RULES
    // ============================================
    history: {
      minRunCompletesForNewBestCelebrate: 2,
      minSprintCompletesForNewBestCelebrate: 2
    },


    // ============================================
    // POWER RUN — secret bonus mode (Power Ball discovery)
    // ============================================
    sprint: {
      enabled: true,
      premiumOnly: true,
      durationMs: 20000,
      faultPenaltyMs: 2000,

      // Teaser: free users can try N Power Runs (lifetime, device-local)
      freeRunsLimit: 5,

      // Entry points (canonical gates)
      // END: show the Power Ball after N completed runs (0 = show from first END)
      // LANDING: show the Power Ball after N completed runs
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
      suppressOnPostPaywall: true,
      suppressWhenWaitlistVisible: true,

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
      showOnSprintEnd: false,
      suppressOnPostPaywall: true,
      suppressWhenHouseAdVisible: true,
      suppressWhenStatsPromptVisible: true,
      suppressWhenShareVisible: true,

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
      runStartOverlayFastTrackMs: 900,
      dailyObjectiveOverlayMs: 1400,
      desktopClickHitReleaseMs: 50,
      opponentSwingMs: 220,
      firstFaultExplainUntilFaultCount: 1,
      lastLifeTriggerLives: 1,

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
      verificationSalt: "kr2026",
      autoOpenDelayMs: 1200,
      autoOpenNewBestScoreMin: 5,
      autoOpenDailyScoreMin: 3
    },

    // ============================================
    // END NUDGES
    // ============================================
    endNudges: {
      showShareOnNewBest: true,
      showShareOnDaily: true,
      showShareByDefault: true,
      autoShareOnNewBest: false,
      autoShareOnDaily: false,
      showStatsPromptWhenReplayPrimary: true,
      suppressShareWhenNoRuns: true,
      suppressStatsPromptWhenNoRuns: true
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
})();
