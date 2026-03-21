// wording.js v1.0 - Kitchen Rush
// UI copy only (split from config.js)
// Kitchen Rush

(() => {
  "use strict";

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
      subtitle: "Your code is ready. Save it, then activate it in game.",

      codeLabel: "Your activation code",
      clearDataWarning: "Keep this code if you clear data or change device.",

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
      shortcutHint: "How to play -> Activate with a code.",

      thankYouLine: "Thank you for supporting an independent game.",
      supportLabel: "Need help?",

      copyCta: "Copy code",
      copyAgainCta: "Copy code again",
      tipNoRecover: "Keep this code safe. It can't be recovered.",
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
      subtitle: "Move into range. Time your hit. Let Kitchen balls bounce. 3 lives.",

      // Daily challenge badge (shown when daily.enabled)
      dailyBadge: "Daily Challenge",
      dailyExplain: "One shared challenge each day. Uses 1 run.",
      classicUnlockHint: "Classic is always available.",
      ctaPlayDaily: "Play Daily Challenge",

      ctaPlay: "Play Classic",
      ctaPlayAfterFirstRun: "Play Classic again",

      bestLabel: "Best",
      bestAriaTemplate: "Personal best: {best} Smashes",
      bestTargetTemplate: "Can you reach {target}?",
      premiumLabel: "Unlimited runs on this device",
      nextPowerLabel: "Next power",
      nextPowerTemplate: "{power} at {score} hits",

      // Landing stats (spark bars)
      runsLabel: "Runs",

      // Lifetime counter (cumulative investment — Eyal Hook model)
      lifetimeTemplate: "{total} total hits",

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
      kitchenOpenLabel: "KITCHEN OPEN",
      waitLabel: "WAIT",
      nowLabel: "NOW!",
      goLabel: "GO!",
      serveLabel: "SERVE",
      doubleBounceLabel: "LET IT BOUNCE",
      returnBounceLabel: "2ND BOUNCE",
      specialBallPrefix: "PWR",
      specialBallDink: "DINK",
      specialBallLob: "LOB",
      specialBallFast: "FAST",
      specialBallSkid: "SKID",
      specialBallHeavy: "HEAVY",
      hitLabel: "HIT",
      controlLeftLabel: "\u25C4",
      controlRightLabel: "\u25BA",
      controlMoveLabel: "MOVE",
      controlTimingLabel: "TIME HIT",
      timingPerfectLabel: "PERFECT!",
      timingNiceLabel: "NICE!",
      startOverlayTouchLeftKey: "Left half",
      startOverlayTouchRightKey: "Right half",
      startOverlayMouseKey: "Mouse",
      startOverlayKeyboardKey: "←↑→↓",
      startOverlayClickKey: "Click / Space",
      startOverlayMoveTouch: "Drag to move",
      startOverlayHitTouch: "Tap to time it",
      startOverlayMoveMouse: "Move on court",
      startOverlayMoveKeys: "Move with arrows",
      startOverlayHitDesktop: "Time your hit",
      startOverlayAutoReturnHint: "Get close for auto-return. Time it for double points.",
      startOverlayKitchenHint: "Kitchen ball: bounce first",
      startOverlayTapToStart: "Tap to start",
      dailyObjectiveMet: "Daily objective complete!",

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
      scoreGainedDoubleDeltaText: "+2",

      // Milestones (brief flash, no interruption)
      // Arc B — rare narrator voice. Mystery box: "What happens deeper?"
      milestone25: "",
      milestone50: "",
      milestone100: ""
    },


    sprint: {
      // Golden Ball (discovery — unlocks Rush/Sprint mode)
      chestAria: "Golden Ball",
      chestHint: "Tap the golden ball to unlock Sprint.",

      // Modal one-shot (first tap ever)
      modalTitle: "You found Sprint mode",
      modalBody: "20 seconds. No lives. Kitchen faults cost 2 seconds.",
      modalCta: "Let's rally",

      // Teaser (free runs limit)
      startOverlayFreeRunsLimitLine: "{remaining}/{limit} free sprints left",
      freeLimitReachedTitle: "That was a rally.",
      freeLimitReachedBody: "Your {limit} free Sprint runs are used.\n\nPremium unlocks unlimited Sprint.",
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
      freeRunsLeftLine: "{remaining}/{limit} free Sprint runs left.",
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
      bestStreakLine: "Best rally: {streak}",

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
      nextRunLabel: "Next run:",
      nextRunBestGap: "+{gap} to beat your best",
      nextRunHoldCleaner: "stay that clean",
      nextRunHoldAccuracy: "keep that timing",
      nextRunHoldStreak: "beat rally {target}",
      nextRunFewerFaults: "1 fewer Kitchen fault",
      nextRunAccuracy: "wait one beat longer",
      nextRunStreak: "push rally {target}",
      nextPowerLabel: "Discover next:",
      nextPowerTemplate: "{power} at {score} hits",

      shareTitle: "Share"
    },


    firstRun: {
      trustLine: "No ads. No tricks. Just the court.",
      kitchenHint: "Kitchen ball? Let it bounce, then hit.",
      rule1: "Move into range",
      rule2: "Tap, click, or press Space to hit",
      rule3: "Serve and return must bounce first"
    },


    paywall: {
      headline: "Keep the rally going.",

      headlineLastFree: "That was your last free run.",

      valueTitle: "What you get",
      trustTitle: "No surprises",

      valueBullets: [
        "Unlimited runs on this device",
        "Sprint mode unlocked",
        "Keep chasing your best"
      ],

      bridgeTitle: "Free runs are done.",
      bridgeBody: "Unlock unlimited play on this device.",

      // Personal progress anchor (shown only if best > 0)
      progressLineTemplate: "Your best: {best} hits.",

      trustLine: "One purchase. No subscription.",
      trustBullets: [
        "One-time payment",
        "No ads, ever",
        "No signup needed",
        "Secure checkout via Stripe"
      ],

      // EARLY-only conversion bump
      savingsLineTemplate: "Save {saveAmount} today.",

      checkoutNote: "Secure one-time checkout via Stripe.",

      ctaEarly: "Unlock - $4.99",
      ctaStandard: "Unlock - $6.99",
      cta: "Unlock",

      alreadyHaveCode: "Have a code? Redeem it here.",
      deviceNote: "Premium stays unlocked on this device.",

      earlyBadgeLabel: "Early bird",
      earlyLabel: "Early price",
      standardLabel: "Standard price",

      timerLabel: "Price increases in:",

      postEarlyLine1: "The early price has ended.",
      postEarlyLine2: "{standardPrice} - one-time purchase on this device.",

      ctaNotNow: "Not now"
    },


    howto: {
      title: "How to play",
      line1: "Balls drop onto the court.",
      line2: "Serve and return must bounce once.",
      line3: "Kitchen ball? Wait for the bounce.",

      ruleTitle: "The Kitchen rule",
      ruleSentence: "The Kitchen is the no-volley zone near the net. Hit too early and you lose a life.",

      premiumTitle: "Premium",
      alreadyPremium: "Premium is already active.",
      activateTitle: "Activate with a code",
      activateLine1: "Have a premium code? Activate it here.",
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
      autoActivateLine1: "Your premium code is already saved.",
      autoActivateLine2: "Activate Premium now?",
      autoActivateCta: "Activate now",
      autoActivateLater: "Not now"
    },


    share: {
      ctaLabel: "Share score",
      ctaDailyLabel: "Share daily score",
      emailAria: "Share via email",
      toastCopied: "Copied!",
      templateDefault: "Kitchen Rush \u2014 {score} Smashes {hashtag}\nCan you beat that?\n{url}",
      templateFault: "Kitchen Rush \u2014 {score} Smashes {hashtag}\nThe Kitchen got me. Your turn.\n{url}",
      templateNewBest: "Kitchen Rush \u2014 NEW BEST: {score} Smashes {hashtag}\nCome get me.\n{url}",
      templateSprint: "Kitchen Rush Sprint \u2014 {score} in 20s {hashtag}\nPure speed. Beat that.\n{url}",
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
      body: "Play instantly and jump back in fast. On iPhone: Share > Add to Home Screen.",
      ctaPrimary: "Add to home screen",
      ctaSecondary: "Later"
    },


    houseAd: {
      eyebrow: "",
      title: "",
      bodyLine1: "Kitchen Rush is a standalone arcade game.",
      bodyLine2: "We make other games too.",
      ctaPrimary: "Try another game",
      ctaRemindLater: "Remind later",

      landingTitle: "",
      landingBodyLine1: "",
      landingBodyLine2: "",
      landingCtaPrimary: "Try another game",
      landingCtaRemindLater: "Remind later"
    },


    waitlist: {
      ctaLabel: "Get updates about future games or features.",
      disclaimer: "No spam. No account.",
      title: "Get updates about future games or features.",
      bodyLine1: "No spam. No account.",
      bodyLine2: "Optional: send one idea too.",
      inputPlaceholder: "Optional: share an idea.",
      cta: "Send email",

      emailSubjectSuffix: "Waitlist",
      emailBodyTemplate: "Hi!\n\nI'd like to join the Kitchen Rush waitlist.\n\nOptional idea:\n{idea}\n\nThanks!"
    },


    statsSharing: {
      sectionTitle: "Anonymous stats",
      buttonLabel: "Share anonymous stats",

      promptTitle: "Help improve Kitchen Rush",
      promptBodyTemplate: "You've completed {runCompletes} runs. Share anonymous stats to help improve the game.",
      promptBodyLastFree: "That was your last free run. Share anonymous stats to help improve the game.",
      promptCtaPrimary: "Preview & share",
      promptCtaSecondary: "Not now",

      modalTitle: "Help improve the game",
      modalDescription: "Share anonymous gameplay stats with the creator. You can review everything below.",
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
      modalBodyLine2: "Copy the address or open your email app.",
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
      dailyObjectiveMet: "Daily objective complete!",
      lastLife: "Last life.",
      closeCall: "Close call!",
      cleanerRun: "Cleaner than last run.",
      betterAccuracy: "Better timing this run.",
      betterStreak: "Best rally up.",
      tooEarly: "Too early!",
      firstFaultExplain: "Yellow ball: wait for the bounce."
    },


    // Arc B — Reserved for future implementation (Caro's design TBD)


    // Court Challenges — contextual micro-objectives (Deci/Ryan + Csikszentmihalyi)
    // Shown on END screen + LANDING (returning). One challenge max. Priority order.
    // All templates receive: {best}, {score}, {faults}, {streak}, {target}, {accuracy}, {gap}
    challenges: {
      // END screen challenges (priority order)
      newBestChallenge: "New record: {score}. Now defend {target}.",
      fewerFaults: "{delta} fewer Kitchen faults. Cleaner run.",
      improvedAccuracy: "Accuracy up {delta}%. Better timing.",
      betterStreak: "Rally up by {delta}. You're reading it better.",
      cleanRun: "Zero Kitchen faults. Do it again.",
      streakChallenge: "Best rally: {streak}. Can you hit {target}?",
      faultHeavy: "{faults} Kitchen faults. Wait for the bounce.",
      lowAccuracy: "{accuracy}% accuracy. Patience wins rallies.",
      // Sprint
      sprintChallenge: "{score} in 20s. Go for {target}.",
      // LANDING challenges (returning player — based on previous run)
      landingFewerFaults: "{delta} fewer faults last run. Keep that feel.",
      landingImprovedAccuracy: "Accuracy was up {delta}%. Stay sharp.",
      landingBetterStreak: "Best rally improved by {delta}. Push again.",
      landingComeback: "Last run: {faults} Kitchen faults. Stay clean.",
      landingStreakPush: "Your best rally was {streak}. Push it.",
      landingNearBest: "{gap} away last time. This could be the one."
    },


    notFound: {
      title: "Out of bounds.",
      line1: "This page went wide.",
      line2: "The court is right where you left it.",
      cta: "Back to court"
    }

  };

})();
