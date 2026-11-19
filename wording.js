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
      skipToContent: "Skip to main content",
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
      openFailed: "Could not open this action.",
      emailOpenFailed: "Could not open your email app.",
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
      benefitSprint: "Power Run unlocked.",
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


    duel: {
      canvasAria: "Match court",
      exit: "Exit match",
      you: "YOU",
      stageLabel: "Opponent {n}",
      modeAria: "Match type",
      singles: "Singles",
      doublesLeft: "Doubles \u00b7 Left",
      doublesRight: "Doubles \u00b7 Right",
      howTouch: "Left half: drag to move. Right half: tap to hit down the middle, or swipe to aim.",
      howKeys: "Arrows / WASD: move. When time slows, hold a direction and press Space \u2014 or click where you want the ball.",
      changeLook: "Change my look",
      focus: "AIM!",
      rules: "First to 5. Serve and return must bounce. No volleys in the Kitchen.",
      start: "Start match",
      next: "Next opponent",
      retry: "Rematch",
      home: "Back to menu",
      win: "You win!",
      lose: "So close. Run it back.",
      yourServe: "Press Space or click to serve.",
      yourServeTouch: "Swipe up on the right, then release to serve.",
      yourPoint: "Your point",
      theirPoint: "Their point",
      out: "Ball out!",
      net: "Ball into the net!",
      twoBounce: "It had to bounce!",
      kitchen: "Volley in the kitchen!",
      serveShort: "Serve too short!",
      kitchen2: "KITCHEN",
      hintMove: "MOVE",
      hintHit: "SWIPE TO HIT",
      recent: "Last matches",
      winLetter: "W",
      loseLetter: "L",
      record: "Wins {w} \u00b7 Best margin +{m}",
      collection: "Opponents beaten",
      goalFirst: "Beat {name} to move up the ladder.",
      goalNext: "Next: beat {name}",
      goalLose: "Lost {you}\u2013{them}. Beat {name} to move up.",
      dailyBtn: "Daily Duel \u00b7 vs {name}",
      dailyDone: "Daily Duel today: {you}\u2013{them} vs {name}",
      dailyGoal: "Daily Duel: {you}\u2013{them} vs {name}. Back tomorrow!",
      share: "Share",
      copied: "Copied!",
      copyFailed: "Copy failed",
      shareText: "Kitchen Rush Daily Duel {date}: {you}\u2013{them} vs {name}",
      powerNames: ["Reach", "Touch", "Power", "Precision", "Sprint", "Kitchen Pass"],
      powerDescs: ["Bigger reach for 10 s", "Longer slow motion for 10 s", "Harder shots, easier smashes for 10 s", "Shots land closer to your target for 10 s", "Move faster for 10 s", "Volleys in the Kitchen are legal for 10 s"],
      powerCharge: "{name} {n}/{m}",
      powerReady: "{name} READY \u00b7 tap or E",
      powerActive: "{name} {s}s",
      powerEquip: "Power: {name} \u2014 {desc}",
      powerNone: "Score points to charge your super power.",
      capsuleHint: "Catch the falling capsules: each gives +1 super charge.",
      capsuleGot: "+1 charge",
      venues: { park: "Wooded park", beach: "Sunset beach", rooftop: "City rooftop" },
      venueAuto: "Auto",
      venueLabel: "Court",
      venueNow: "Playing at: {name}",
      venueLocked: "Reach opponent {n} to unlock",
      tabs: { play: "Play", players: "Players", courts: "Courts", progress: "Progress" },
      coachServeTouch: "Your serve: drag toward where you want the ball, then release.",
      coachServeKeys: "Your serve: hold a direction and press Space, or click where you want the ball.",
      coachReturn: "First return: move toward the bounce marker.",
      coachFirstReturn: "Nice return! Keep the rally going.",
      practiceTitle: "Drills",
      shopTitle: "Power shop",
      shopTry: "Try",
      shopTrialHelp: "Activate the charged super and try a return.",
      drillAgain: "Try again",
      drillPrevious: "Previous best: {n}/{total}",
      shopBack: "Back to this power",
      resumeMatch: "Resume: {player} · {court}",
      courtUnlocked: "Court unlocked: {name}",
      shareDaily: "Share the challenge",
      dailyReset: "Next challenge at {time} (local time)",
      drillRecommended: "Practise: {name}",
      drillShotStyle: "Shot: {name}",
      drillShotSwitch: "{name}. Switch shot type.",
      drillShotStyles: { touch: "Touch", drive: "Drive" },
      drillMissReasons: {
        short: "Too short", long: "Too long", left: "Too far left", right: "Too far right",
        net: "Into the net", winner: "The ball bounced twice", twoBounce: "Wait for the bounce", kitchen: "Volley in the kitchen"
      },
      shopNative: "Use character super",
      shopRule: "Equip one super for classic matches. Bought powers can be equipped again for free.",
      drillStart: "Practise",
      drillNames: { deep: "Deep return", angle: "Placement", soft: "Short shot" },
      drillGoals: { deep: "Return deep into the marked zone.", angle: "Aim for the highlighted side.", soft: "Land a soft shot in the kitchen." },
      drillBest: "Best: {n}/{total}",
      drillReward: "{n} Rush Tokens at {goal}/{total}",
      drillClaimed: "Reward earned",
      drillScore: "{hits} targets · {attempts}/{total} balls",
      drillHit: "Target hit!",
      drillMiss: "Target missed",
      drillResult: "Targets hit: {n}/{total}",
      difficultyLabel: "Match difficulty",
      difficultyLevels: { relaxed: "Relaxed", standard: "Standard", challenge: "Challenge" },
      shotEarly: "Too early — wait for the ball to come to your side.",
      shotReach: "Out of reach — move closer to the ball.",
      nextRival: "Next opponent: {name}",
      resultMenu: "Match menu",
      retryTips: {
        net: "On the next return, aim deeper to clear the net.",
        out: "Aim toward the middle to leave room for error.",
        twoBounce: "Let the serve and the return bounce before you hit.",
        kitchen: "Stay behind the kitchen line to volley.",
        serveShort: "Serve beyond the kitchen line.",
        winner: "Move toward the bounce as soon as the ball crosses the net."
      },
      coachMove: "Get to the ball. You hit it after its first bounce.",
      coachAimTouch: "Swipe on the right half to aim, then release to hit.",
      coachAimKeys: "Time slows down! Hold a direction and press Space, or click where you want the ball.",
      coachNice: "Nice! Keep the rally going. Grab capsules for bonuses.",
      tutorialBtn: "Replay the tutorial",
      fmtFirst: "First to {n}.",
      fmtRally: "First to {n}, win by 2. Every rally scores.",
      fmtOfficial: "Official: to 11, win by 2, only the serving side scores.",
      officialToggle: "Official match: to 11, real scoring",
      callLabel: "Call: {c}",
      sideOut: "Side out",
      missionsTitle: "Today's missions",
      missionNames: { win: "Win a match", points: "Score {n} points", caps: "Catch {n} capsules", rally: "Reach a {n}-shot rally", super: "Use your super {n} times" },
      missionDone: "Mission complete! +{n} Rush Tokens",
      streakLine: "Streak: {n} days",
      streakBonus: "Day {n} in a row! +{c} Rush Tokens",
      nextUnlock: "{n} more Rush Tokens for {name}",
      nextUnlockReady: "You can unlock {name}!",
      masteryLine: "{name}: {n} wins",
      endingTitle: "{name}: the ending",
      endingsLine: "Endings unlocked: {n}/{m}",
      endings: {
        touch: "{name} slowed time so much that the final dink is still floating over the net. The crowd is still waiting. Nobody minds.",
        sprint: "{name} ran to the trophy so fast that it arrived before the last point. It had to wait, politely.",
        reach: "With that kind of reach, {name} high-fived the whole stadium without leaving the court.",
        precision: "{name} landed match point on a coin at the baseline. The coin is now in a museum.",
        power: "{name}'s last smash is still in orbit. Scientists call it the Kitchen Rush comet.",
        pass: "{name} took over Captain Kitchen's kitchen and cooked a victory feast for both teams."
      },
      announceGo: "Play!",
      announceBoss: "Final boss!",
      selectTitle: "Choose your player",
      selectOk: "Continue",
      setupNextCourt: "Choose setting",
      setupStepPlayer: "Player",
      setupStepMatch: "Match",
      setupNextMatch: "See the matchup",
      setupCourtTitle: "Choose a setting",
      setupBackPlayer: "Back to player selection",
      selectOpen: "Open the select screen",
      superLine: "Super: {name} \u2014 {desc}",
      versusVs: "VS",
      versusTap: "Tap to start",
      versusAria: "{a} versus {b}. Start the match",
      splashWin: "VICTORY!",
      splashBoss: "BOSS DEFEATED!",
      splashLose: "Not this time",
      playerEquip: "Equip",
      playerEquipped: "Equipped",
      playerMissing: "Need {n} more Rush Tokens",
      winRate: "Win rate {p}% over {n} matches \u00b7 avg {m}",
      noProgress: "Play a match to see your progress here.",
      exportBtn: "Copy my playtest data",
      exportDone: "Copied!",
      exportFail: "Copy failed",
      soundOn: "Sound on",
      soundOff: "Sound off",
      saveImage: "Save image",
      shareBonus: "+{n} Rush Tokens for sharing!",
      coins: "Rush Tokens: {n}",
      earned: "+{n} Rush Tokens",
      playerLabel: "My player",
      playerBuy: "Buy for {n} Rush Tokens",
      playerNeed: "Not enough Rush Tokens ({n})",
      castLabel: "Duel players",
      castSkills: { touch: "Slow motion", sprint: "Fast footwork", reach: "Long reach", precision: "Precision", power: "Smash", pass: "Capsules" },
      playerSkill: { touch: "Right-handed all-rounder: slows time by 40% to adapt to every rally.", sprint: "Right-handed speedster: +12% movement and fast footwork.", reach: "Right-handed defender: +15% reach for deep returns and counters.", precision: "Right-handed placer: starts each match with 1 charge and targets corners.", power: "Right-handed attacker: easier, faster smashes and powerful drives.", pass: "Right-handed support player: capsules arrive sooner, last longer and are easier to catch." },
      playerSlogan: { touch: "New game, new life!", sprint: "Zero paddle, zero panic!", reach: "It’s only the beginning!", precision: "No second thoughts!", power: "Another training session!", pass: "Point by point!" },
      playerWeakness: { touch: "Needs time to charge the super.", sprint: "Less reach on deep balls.", reach: "Slower between shots.", precision: "Needs a clear target.", power: "Less agile at the net.", pass: "Lower raw power." },
      worldLabel: "World {w}",
      worldUp: "World {w} unlocked: tougher opponents",
      rallyLabel: "RALLY {n}",
      bossLabel: "FINAL BOSS",
      bossIntro: "FINAL BOSS: {name}",
      bossRage: "RAGE!",
      bossWin: "Boss defeated!",
      traitLabel: "Style: {x}",
      traits: { centre: "mostly down the middle", sides: "goes wide", tempo: "mixes soft and hard", left: "favours your left", right: "favours your right" }
    },

    // French overrides for `duel` (keys missing here fall back to English).
    duelFr: {
      canvasAria: "Terrain de match",
      exit: "Quitter le match",
      you: "VOUS",
      stageLabel: "Adversaire {n}",
      modeAria: "Type de match",
      singles: "Simple",
      doublesLeft: "Double \u00b7 Gauche",
      doublesRight: "Double \u00b7 Droite",
      howTouch: "À gauche, glissez pour vous déplacer. À droite, touchez pour frapper au milieu ou glissez pour viser.",
      howKeys: "Fl\u00e8ches / WASD : bouger. Quand le temps ralentit, tenez une direction puis Espace, ou cliquez o\u00f9 vous voulez la balle.",
      changeLook: "Changer mon look",
      focus: "VISEZ !",
      rules: "Premier \u00e0 5. Service et retour doivent rebondir. Pas de vol\u00e9e dans la cuisine.",
      start: "Commencer le match",
      next: "Adversaire suivant",
      retry: "Revanche",
      home: "Retour au menu",
      win: "Victoire !",
      lose: "Si pr\u00e8s. On recommence.",
      yourServe: "Pour servir, appuyez sur Espace ou cliquez.",
      yourServeTouch: "À droite, glissez vers le haut puis relâchez pour servir.",
      yourPoint: "Point pour vous",
      theirPoint: "Point adverse",
      out: "Balle sortie !",
      net: "Balle dans le filet !",
      twoBounce: "Il fallait attendre le rebond !",
      kitchen: "Volée dans la cuisine !",
      serveShort: "Service trop court !",
      kitchen2: "CUISINE",
      hintMove: "BOUGER",
      hintHit: "GLISSER POUR FRAPPER",
      recent: "Derniers matchs",
      winLetter: "V",
      loseLetter: "D",
      record: "Victoires {w} \u00b7 Meilleur \u00e9cart +{m}",
      collection: "Adversaires battus",
      goalFirst: "Battez {name} pour monter dans l'\u00e9chelle.",
      goalNext: "Prochain objectif : battre {name}",
      goalLose: "Perdu {you}\u2013{them}. Battez {name} pour monter.",
      dailyBtn: "Duel du jour \u00b7 contre {name}",
      dailyDone: "Duel du jour : {you}\u2013{them} contre {name}",
      dailyGoal: "Duel du jour : {you}\u2013{them} contre {name}. \u00c0 demain !",
      share: "Partager",
      copied: "Copi\u00e9 !",
      copyFailed: "Copie impossible",
      shareText: "Kitchen Rush, Duel du jour {date} : {you}\u2013{them} contre {name}",
      powerNames: ["Allonge", "Toucher", "Puissance", "Pr\u00e9cision", "Sprint", "Passe-cuisine"],
      powerDescs: ["Port\u00e9e accrue pendant 10 s", "Ralenti plus long pendant 10 s", "Frappes plus fortes, smashs plus faciles pendant 10 s", "Vos frappes tombent plus pr\u00e8s de la cible pendant 10 s", "Courez plus vite pendant 10 s", "Les vol\u00e9es en cuisine sont permises pendant 10 s"],
      powerCharge: "{name} {n}/{m}",
      powerReady: "{name} PR\u00caT \u00b7 touchez ou E",
      powerActive: "{name} {s} s",
      powerEquip: "Pouvoir : {name} \u2014 {desc}",
      powerNone: "Marquez des points pour charger votre super pouvoir.",
      capsuleHint: "Attrapez les capsules qui tombent : chacune donne +1 charge de super pouvoir.",
      capsuleGot: "+1 charge",
      venues: { park: "Parc arboré", beach: "Plage au coucher du soleil", rooftop: "Toit-terrasse en ville" },
      venueAuto: "Auto",
      venueLabel: "Terrain",
      venueNow: "Vous jouez : {name}",
      venueLocked: "Atteignez l'adversaire {n} pour d\u00e9bloquer",
      tabs: { play: "Jouer", players: "Joueurs", courts: "Terrains", progress: "Progr\u00e8s" },
      coachServeTouch: "Votre service : glissez vers l'endroit vis\u00e9, puis rel\u00e2chez.",
      coachServeKeys: "Votre service : tenez une direction et appuyez sur Espace, ou cliquez o\u00f9 vous voulez la balle.",
      coachReturn: "Premier retour : placez-vous près du repère de rebond.",
      coachFirstReturn: "Beau retour ! Continuez l’échange.",
      practiceTitle: "Exercices",
      shopTitle: "Boutique",
      shopTry: "Essayer",
      shopTrialHelp: "Activez le super déjà chargé et essayez un retour.",
      drillAgain: "Réessayer",
      drillPrevious: "Record précédent : {n}/{total}",
      shopBack: "Revenir à ce pouvoir",
      resumeMatch: "Reprendre : {player} · {court}",
      courtUnlocked: "Terrain débloqué : {name}",
      shareDaily: "Partager le défi",
      dailyReset: "Prochain défi à {time} (heure locale)",
      drillRecommended: "Travailler : {name}",
      drillShotStyle: "Coup : {name}",
      drillShotSwitch: "{name}. Changer de type de coup.",
      drillShotStyles: { touch: "Toucher", drive: "Drive" },
      drillMissReasons: {
        short: "Trop court", long: "Trop long", left: "Trop à gauche", right: "Trop à droite",
        net: "Balle dans le filet", winner: "La balle a rebondi deux fois", twoBounce: "Attendez le rebond", kitchen: "Volée dans la cuisine"
      },
      shopNative: "Utiliser le super du personnage",
      shopRule: "Équipez un seul super pour un match classique. Un pouvoir acheté peut être rééquipé gratuitement.",
      drillStart: "S’entraîner",
      drillNames: { deep: "Retour profond", angle: "Placement latéral", soft: "Balle courte" },
      drillGoals: { deep: "Renvoyez au fond, dans la zone marquée.", angle: "Visez le côté indiqué.", soft: "Déposez une balle douce dans la cuisine." },
      drillBest: "Record : {n}/{total}",
      drillReward: "{n} jetons Rush à {goal}/{total}",
      drillClaimed: "Récompense obtenue",
      drillScore: "{hits} cibles · {attempts}/{total} balles",
      drillHit: "Cible atteinte !",
      drillMiss: "Cible manquée",
      drillResult: "Cibles atteintes : {n}/{total}",
      difficultyLabel: "Difficulté du match",
      difficultyLevels: { relaxed: "Détente", standard: "Standard", challenge: "Défi" },
      shotEarly: "Trop tôt. Attendez que la balle arrive de votre côté.",
      shotReach: "Hors de portée. Rapprochez-vous de la balle.",
      nextRival: "Prochain adversaire : {name}",
      resultMenu: "Menu du match",
      retryTips: {
        net: "Au prochain retour, visez plus long pour franchir le filet.",
        out: "Visez le milieu pour laisser de la marge.",
        twoBounce: "Laissez rebondir le service et le retour avant de frapper.",
        kitchen: "Restez derrière la ligne de la cuisine pour jouer de volée.",
        serveShort: "Servez au-delà de la ligne de la cuisine.",
        winner: "Déplacez-vous vers le rebond dès que la balle franchit le filet."
      },
      coachMove: "Placez-vous sur la balle. Vous la frappez apr\u00e8s son premier rebond.",
      coachAimTouch: "À droite, glissez pour viser puis relâchez pour frapper.",
      coachAimKeys: "Le temps ralentit ! Tenez une direction et appuyez sur Espace, ou cliquez o\u00f9 vous voulez la balle.",
      coachNice: "Bien jou\u00e9 ! Continuez l'\u00e9change. Attrapez les capsules pour des bonus.",
      tutorialBtn: "Rejouer le tutoriel",
      fmtFirst: "Premier à {n}.",
      fmtRally: "Premier à {n}, 2 points d’écart. Chaque échange compte.",
      fmtOfficial: "Officiel : 11 points, 2 points d’écart, seul le camp au service marque.",
      officialToggle: "Match officiel : 11 points, vrai décompte",
      callLabel: "Annonce : {c}",
      sideOut: "Changement de service",
      missionsTitle: "Missions du jour",
      missionNames: { win: "Gagner un match", points: "Marquer {n} points", caps: "Attraper {n} capsules", rally: "Tenir un échange de {n} frappes", super: "Utiliser votre super {n} fois" },
      missionDone: "Mission accomplie ! +{n} jetons Rush",
      streakLine: "Série : {n} jours",
      streakBonus: "{n} jours d’affilée ! +{c} jetons Rush",
      nextUnlock: "Plus que {n} jetons Rush pour {name}",
      nextUnlockReady: "Vous pouvez débloquer {name} !",
      masteryLine: "{name} : {n} victoires",
      endingTitle: "{name} : la fin",
      endingsLine: "Fins débloquées : {n}/{m}",
      endings: {
        touch: "{name} a tellement ralenti le temps que le dernier amorti flotte encore au-dessus du filet. Le public attend toujours. Personne ne s’en plaint.",
        sprint: "{name} a couru si vite vers le trophée qu’il a fallu attendre poliment la fin du dernier point.",
        reach: "Avec une telle allonge, {name} a tapé dans la main de tout le stade sans quitter le terrain.",
        precision: "{name} a posé la balle de match pile sur une pièce au fond du court. La pièce est aujourd’hui au musée.",
        power: "Le dernier smash de {name} est toujours en orbite. Les scientifiques l’appellent la comète Kitchen Rush.",
        pass: "{name} a repris la cuisine de Captain Kitchen et a préparé un festin de victoire pour les deux équipes."
      },
      announceGo: "Jouez !",
      announceBoss: "Boss final !",
      selectTitle: "Choisissez votre joueur",
      selectOk: "Continuer",
      setupNextCourt: "Choisir le décor",
      setupStepPlayer: "Joueur",
      setupStepMatch: "Match",
      setupNextMatch: "Commencer le match",
      setupCourtTitle: "Choisissez le décor",
      setupBackPlayer: "Revenir au choix du joueur",
      selectOpen: "Ouvrir l\u2019\u00e9cran de choix",
      superLine: "Super : {name} \u2014 {desc}",
      versusVs: "VS",
      versusTap: "Touchez pour commencer",
      versusAria: "{a} contre {b}. Commencer le match",
      splashWin: "VICTOIRE !",
      splashBoss: "BOSS VAINCU !",
      splashLose: "Pas cette fois",
      playerEquip: "\u00c9quiper",
      playerEquipped: "\u00c9quip\u00e9",
      playerMissing: "Il manque {n} jetons Rush",
      winRate: "{p} % de victoires sur {n} matchs \u00b7 dur\u00e9e moy. {m}",
      noProgress: "Jouez un match pour voir votre progression ici.",
      exportBtn: "Copier mes donn\u00e9es de test",
      exportDone: "Copi\u00e9 !",
      exportFail: "Copie impossible",
      soundOn: "Son activ\u00e9",
      soundOff: "Son coup\u00e9",
      saveImage: "Enregistrer l'image",
      shareBonus: "+{n} jetons Rush pour le partage !",
      coins: "Jetons Rush : {n}",
      earned: "+{n} jetons Rush",
      playerLabel: "Mon joueur",
      playerBuy: "Acheter pour {n} jetons Rush",
      playerNeed: "Pas assez de jetons Rush ({n})",
      castLabel: "Joueurs du Duel",
      castSkills: { touch: "Ralenti", sprint: "Vitesse", reach: "Portée", precision: "Précision", power: "Smash", pass: "Capsules" },
      playerSkill: { touch: "Polyvalent droitier : ralenti de 40 % pour s\u2019adapter \u00e0 chaque \u00e9change.", sprint: "Sprinteur droitier : +12 % de vitesse et jeu de jambes.", reach: "D\u00e9fenseur droitier : +15 % de port\u00e9e pour les retours profonds.", precision: "Placeuse droiti\u00e8re : 1 charge au d\u00e9but et vise les coins.", power: "Attaquante droiti\u00e8re : smashs plus faciles et frappes puissantes.", pass: "Soutien droitier : capsules plus t\u00f4t, plus longtemps et plus faciles \u00e0 attraper." },
      playerSlogan: { touch: "Nouveau jeu, nouvelle vie !", sprint: "Zéro raquette, zéro panique !", reach: "Ce n’est que le début !", precision: "Pas d’états d’âme !", power: "Encore un entraînement !", pass: "Point après point !" },
      playerWeakness: { touch: "Le super met du temps à se charger.", sprint: "Moins de portée sur les balles profondes.", reach: "Moins rapide entre deux frappes.", precision: "A besoin d’une cible nette.", power: "Moins agile près du filet.", pass: "Moins de puissance brute." },
      worldLabel: "Monde {w}",
      worldUp: "Monde {w} d\u00e9bloqu\u00e9 : adversaires plus forts",
      rallyLabel: "\u00c9CHANGE {n}",
      bossLabel: "BOSS FINAL",
      bossIntro: "BOSS FINAL : {name}",
      bossRage: "FUREUR !",
      bossWin: "Boss vaincu !",
      traitLabel: "Style : {x}",
      traits: { centre: "surtout au milieu", sides: "joue large", tempo: "alterne doux et fort", left: "pr\u00e9f\u00e8re votre gauche", right: "pr\u00e9f\u00e8re votre droite" },
      tags: ["L\u00e0 pour le plaisir", "Mains douces, balles courtes", "Adore la balle haute", "Frappe tout tr\u00e8s fort", "Trouve tous les coins", "Ma\u00eetre de la ligne", "Boss final : ne rate jamais un amorti"]
    },

    landing: {
      title: "Kitchen Rush",
      tagline: "Fast pickleball arcade.",
      subtitle: "Aim your shots, own the Kitchen, climb the ladder.",
      ctaDuel: "Play",
      duelExplain: "Singles or doubles against six opponents.",
      arcadeLabel: "Arcade modes",

      // Daily challenge badge (shown when daily.enabled)
      dailyBadge: "Daily Challenge",
      dailyExplain: "One shared challenge each day.",
      classicUnlockHint: "Classic is always available.",
      ctaPlayDaily: "Play Daily Challenge",

      ctaPlay: "Play Classic",
      ctaPlayAfterFirstRun: "Play Classic again",

      bestLabel: "Best",
      bestAriaTemplate: "Personal best: {best} Smashes",
      bestTargetTemplate: "Can you reach {target}?",
      premiumLabel: "Unlimited runs on this device",
      powerTease: "Longer runs unlock powers.",
      nextPowerLabel: "Next power",
      nextPowerTemplate: "{power} at {score} hits",
      weeklyPowerLabel: "This week",
      weeklyPowerTemplate: "{power} featured",

      // Landing stats (spark bars)
      runsLabel: "Runs",

      // Lifetime counter (cumulative investment — Eyal Hook model)
      lifetimeTemplate: "{total} total hits",

      // Post-paywall block (LANDING after free runs exhausted)
      postPaywallTitle: "Free runs are used up.",
      postPaywallBody: "Unlock unlimited runs and keep discovering new powers.",
      postPaywallCta: "See options",

      // Post-paywall + secret bonus hint
      postPaywallSbTitle: "Before you decide...",
      postPaywallSbBody: "You've got a secret mode to find. Look for the power ball."
    },


    ui: {
      livesLabel: "Lives",
      livesAria: "{lives} lives remaining",
      scoreLabel: "",
      scoreAriaTemplate: "Score: {score} Smashes",
      sprintTimerAriaTemplate: "Time left: {remaining} seconds",
      gameOverTitle: "Game over",

      // V2: Canvas in-game labels (drawn on canvas, not DOM)
      kitchenLabel: "KITCHEN",
      comboLabel: "STREAK",
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
      powerUpExtraLife: "EXTRA LIFE",
      powerUpShield: "SHIELD",
      powerUpSpeedBoost: "SPEED",
      powerUpPerfectWindow: "FOCUS",
      powerUpSmashBoost: "SMASH x2",
      powerUpWeeklyPrefix: "WEEKLY",
      powerUpReadyPrefix: "POWER",
      powerUpActivePrefix: "ACTIVE",
      powerUpSavedByShield: "SHIELD SAVE",
      powerUpRevealHint: "Deeper runs unlock stronger powers.",
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
      startOverlayPowerHint: "Longer runs unlock power balls and boosts.",
      startOverlayTapToStart: "Tap to start",
      matchViewToggleTemplate: "View: {view}",
      matchViewBroadcast: "Broadcast",
      matchViewPlayer: "Player",
      dailyObjectiveMet: "Daily objective complete!",

      // Start-of-run overlay (economy)
      startRunTypeFree: "FREE RUN",
      startRunTypeLastFree: "Last free run.",
      startRunTypeUnlimited: "",
      startRunRemainingTemplate: "{remaining}/{limit} free runs left",

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
      // Power Ball (discovery — unlocks the bonus mode)
      chestAria: "Power Ball",
      chestHint: "Tap the power ball to unlock Power Run.",

      // Modal one-shot (first tap ever)
      modalTitle: "You found Power Run",
      modalBody: "20 seconds. No lives. Kitchen faults cost 2 seconds.",
      modalCta: "Let's rally",

      // Teaser (free runs limit)
      startOverlayFreeRunsLimitLine: "{remaining}/{limit} free Power Runs left",
      freeLimitReachedTitle: "That was a rally.",
      freeLimitReachedBody: "Your {limit} free Power Runs are used.\n\nPremium unlocks unlimited Power Run.",
      freeLimitReachedCta: "Unlock Power Run",
      freeLimitReachedClose: "Not now",

      // In-game HUD
      title: "Power Run",
      timerLabel: "{remaining}s",
      penaltyFlash: "-2s",

      // Start overlay
      startOverlayLine1: "20 seconds. No lives.",
      startOverlayLine2: "Kitchen faults cost 2 seconds.",
      startOverlayTapAnywhere: "Tap anywhere to go",

      // End screen
      endTitle: "Time!",
      scoreLine: "{score} hits in 20s",
      bestLine: "Power Run best: {best}",
      freeRunsLeftLine: "{remaining}/{limit} free Power Runs left.",
      newBest: "New Power Run record!",
      playAgain: "Power Run again",
      backToRuns: "Back to court",

      // End toast
      endGameOverToast: "Time's up",

      // CTA
      ctaPlayAgain: "Power Run again"
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
      weeklyPowerLabel: "This week:",
      weeklyPowerTemplate: "{power} featured",

      shareTitle: "Share"
    },


    firstRun: {
      trustLine: "No ads. No tricks. Just the court.",
      kitchenHint: "Kitchen ball? Let it bounce, then hit.",
      powerHint: "Stay alive long enough and new powers start to appear.",
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
        "Power Run unlocked",
        "Keep chasing your best",
        "Reach deeper power unlocks"
      ],

      bridgeTitle: "Free runs are done.",
      bridgeBody: "Unlock unlimited play on this device.",

      // Personal progress anchor (shown only if best > 0)
      progressLineTemplate: "Your best: {best} hits.",
      progressionLine: "Deeper runs unlock more power balls and short boosts.",

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
      templateSprint: "Kitchen Rush Power Run \u2014 {score} in 20s {hashtag}\nPure speed. Beat that.\n{url}",
      templateDaily: "Kitchen Rush Daily ({date}) {modifier}\n{score} Smashes | Streak {streak} {hashtag}\nSame challenge for everyone. Can you beat {score}?\n{url}",

      // Hashtag (dynamic: #KitchenRush{score})
      hashtagPrefix: "#KitchenRush",

      // Share card modal (auto-shown after new best)
      cardModalTitle: "New personal best!",

      // V2: Share card labels (canvas image)
      cardSprintLabel: "Power Run",
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
      label: "Contact",
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
