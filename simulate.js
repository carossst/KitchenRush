// Kitchen Rush — 100 Persona Simulation
// Uses REAL game parameters from config.js
// Models: gameplay, learning curve, emotional peaks, conversion funnel, churn

"use strict";

// ============================================
// GAME PARAMETERS (from config.js)
// ============================================
const CFG = {
  lives: 3,
  onboardingShield: 3,
  reboundDelayMs: 150,
  speed: { base: 2.2, accelPerSec: 0.04 },
  spawn: { initialMs: 1200, decayPerSec: 12, minMs: 400 },
  window: { initialMs: 140, decayPerSec: 1.2, minMs: 80 },
  kitchenRatio: { base: 0.3, growthPerSec: 0.01, max: 0.7 },
  ballTypes: {
    dink: { unlockAfterSec: 15, weight: 0.2, speedMul: 0.5, forceKitchen: true, tapMul: 1.8 },
    lob: { unlockAfterSec: 30, weight: 0.15, speedMul: 0.35, tapMul: 0.7 },
    fast: { unlockAfterSec: 45, weight: 0.15, speedMul: 2.0, tapMul: 0.6 }
  },
  freeRuns: 3,
  sprintFreeRuns: 2,
  sprintDurationMs: 20000,
  sprintFaultPenaltyMs: 2000,
  earlyPriceCents: 499,
  standardPriceCents: 699,
  chestGateLanding: 1,
  chestGateEnd: 0
};

// ============================================
// PERSONA ARCHETYPES
// ============================================
const ARCHETYPES = [
  // name, count, traits
  // reflex = probability of hitting a ball in the tap window (0-1)
  // patience = willingness to wait/explore (0-1)
  // kitchenLearn = how fast they learn the Kitchen rule (0-1)
  // Note: onboarding shield gives 3 free non-Kitchen balls, so even low-reflex players get 1-3 smashes
  { name: "Casual Mobile", count: 25, reflex: [0.4, 0.6], patience: [0.3, 0.6], kitchenLearn: [0.35, 0.65], priceThreshold: [300, 600], age: [14, 55], pbAware: [0, 0.15], shareProb: [0.05, 0.2], returnD1: [0.15, 0.35] },
  { name: "Pickleball Fan", count: 15, reflex: [0.5, 0.7], patience: [0.5, 0.8], kitchenLearn: [0.75, 0.95], priceThreshold: [400, 900], age: [22, 60], pbAware: [0.8, 1.0], shareProb: [0.15, 0.4], returnD1: [0.4, 0.7] },
  { name: "Gamer Teen", count: 15, reflex: [0.65, 0.85], patience: [0.2, 0.45], kitchenLearn: [0.45, 0.75], priceThreshold: [100, 400], age: [13, 19], pbAware: [0.05, 0.3], shareProb: [0.25, 0.5], returnD1: [0.2, 0.45] },
  { name: "Score Chaser", count: 10, reflex: [0.7, 0.9], patience: [0.6, 0.9], kitchenLearn: [0.6, 0.85], priceThreshold: [500, 1000], age: [18, 40], pbAware: [0.1, 0.5], shareProb: [0.3, 0.55], returnD1: [0.5, 0.8] },
  { name: "Bored Commuter", count: 15, reflex: [0.4, 0.6], patience: [0.15, 0.4], kitchenLearn: [0.35, 0.6], priceThreshold: [200, 500], age: [22, 50], pbAware: [0.05, 0.2], shareProb: [0.03, 0.12], returnD1: [0.1, 0.25] },
  { name: "Curious Clicker", count: 10, reflex: [0.3, 0.5], patience: [0.1, 0.3], kitchenLearn: [0.25, 0.5], priceThreshold: [0, 300], age: [16, 65], pbAware: [0, 0.1], shareProb: [0.01, 0.08], returnD1: [0.05, 0.15] },
  { name: "Sports Parent", count: 5, reflex: [0.4, 0.6], patience: [0.5, 0.75], kitchenLearn: [0.65, 0.9], priceThreshold: [400, 800], age: [30, 55], pbAware: [0.5, 0.9], shareProb: [0.1, 0.3], returnD1: [0.3, 0.55] },
  { name: "Arcade Nostalgic", count: 5, reflex: [0.55, 0.75], patience: [0.5, 0.7], kitchenLearn: [0.5, 0.7], priceThreshold: [400, 800], age: [28, 50], pbAware: [0.05, 0.3], shareProb: [0.12, 0.25], returnD1: [0.35, 0.6] },
];

// ============================================
// HELPERS
// ============================================
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ============================================
// SIMULATE ONE RUN
// ============================================
function simulateRun(persona, runNumber, mode) {
  const isRun = (mode === "RUN");
  let elapsedSec = 0;
  let smashes = 0;
  let faults = 0;
  let misses = 0;
  let lives = isRun ? CFG.lives : null;
  let sprintRemaining = isRun ? null : CFG.sprintDurationMs;
  let streak = 0;
  let maxStreak = 0;
  let totalBalls = 0;
  let emotionalPeak = 0;

  // Skill improves over runs (learning curve)
  const runBonus = Math.min(runNumber * 0.03, 0.2);
  const effectiveReflex = clamp(persona.reflex + runBonus, 0, 0.95);
  const effectiveKitchenLearn = clamp(persona.kitchenLearn + runBonus * 0.5, 0, 0.95);

  // Simulate ball spawns
  let lastSpawn = 0;
  const maxTime = isRun ? 120 : CFG.sprintDurationMs / 1000; // cap RUN at 2 min

  while (elapsedSec < maxTime) {
    // Spawn interval
    const spawnInterval = Math.max(
      CFG.spawn.minMs,
      CFG.spawn.initialMs - CFG.spawn.decayPerSec * elapsedSec
    ) / 1000;

    elapsedSec += spawnInterval;
    if (!isRun && sprintRemaining !== null) {
      sprintRemaining -= spawnInterval * 1000;
      if (sprintRemaining <= 0) break;
    }

    totalBalls++;

    // Kitchen ratio
    const kitchenRatio = clamp(
      CFG.kitchenRatio.base + CFG.kitchenRatio.growthPerSec * elapsedSec,
      0, CFG.kitchenRatio.max
    );

    // Onboarding shield
    const isKitchen = (totalBalls <= CFG.onboardingShield) ? false : (Math.random() < kitchenRatio);

    // Ball type (V2)
    let ballType = "normal";
    if (elapsedSec >= 45 && Math.random() < 0.15) ballType = "fast";
    else if (elapsedSec >= 30 && Math.random() < 0.15) ballType = "lob";
    else if (elapsedSec >= 15 && Math.random() < 0.2) ballType = "dink";

    // Tap window
    let tapMul = 1;
    if (ballType === "dink") tapMul = 1.8;
    else if (ballType === "lob") tapMul = 0.7;
    else if (ballType === "fast") tapMul = 0.6;

    const tapWindowMs = Math.max(
      CFG.window.minMs,
      (CFG.window.initialMs - CFG.window.decayPerSec * elapsedSec) * tapMul
    );

    // Speed factor
    let speedMul = 1;
    if (ballType === "fast") speedMul = 2.0;
    else if (ballType === "lob") speedMul = 0.35;
    else if (ballType === "dink") speedMul = 0.5;

    const effectiveSpeed = (CFG.speed.base + CFG.speed.accelPerSec * elapsedSec) * speedMul;

    // PLAYER DECISION
    if (isKitchen) {
      // Kitchen ball: player must wait for bounce
      let waitProb = effectiveKitchenLearn;
      if (ballType === "dink") waitProb = clamp(waitProb + 0.15, 0, 0.95);

      if (Math.random() < waitProb) {
        // Waited correctly → now must tap in window
        // Window difficulty: 140ms = easy (1.0), 80ms = hard (0.6)
        const windowDifficulty = clamp(tapWindowMs / 160, 0.5, 1.2);
        const hitProb = clamp(effectiveReflex * windowDifficulty, 0.15, 0.95);
        if (Math.random() < hitProb) {
          smashes++;
          streak++;
          maxStreak = Math.max(maxStreak, streak);
          emotionalPeak = Math.max(emotionalPeak, streak * 0.12 + smashes * 0.03);
        } else {
          misses++;
          streak = 0;
          if (isRun) { lives--; if (lives <= 0) break; }
        }
      } else {
        // Tapped too early → FAULT
        faults++;
        streak = 0;
        if (isRun) {
          lives--; if (lives <= 0) break;
        } else {
          sprintRemaining -= CFG.sprintFaultPenaltyMs;
          if (sprintRemaining <= 0) break;
        }
      }
    } else {
      // Non-kitchen ball: tap in window
      // Speed difficulty: fast balls are harder, lobs are easier
      const speedDifficulty = (ballType === "fast") ? 0.65 : (ballType === "lob" ? 0.9 : 1.0);
      const windowDifficulty = clamp(tapWindowMs / 160, 0.5, 1.2);
      const hitProb = clamp(effectiveReflex * speedDifficulty * windowDifficulty, 0.2, 0.95);
      if (Math.random() < hitProb) {
        smashes++;
        streak++;
        maxStreak = Math.max(maxStreak, streak);
        emotionalPeak = Math.max(emotionalPeak, streak * 0.12 + smashes * 0.03);
      } else {
        misses++;
        streak = 0;
        if (isRun) { lives--; if (lives <= 0) break; }
      }
    }
  }

  return {
    mode, smashes, faults, misses, maxStreak, totalBalls,
    elapsedSec: Math.round(elapsedSec * 10) / 10,
    emotionalPeak: Math.round(emotionalPeak * 100) / 100
  };
}

// ============================================
// SIMULATE FULL PLAYER JOURNEY
// ============================================
function simulatePersona(persona) {
  const journey = {
    id: persona.id,
    archetype: persona.archetype,
    age: persona.age,
    pbAware: persona.pbAware,
    reflex: Math.round(persona.reflex * 100),
    patience: Math.round(persona.patience * 100),
    kitchenLearn: Math.round(persona.kitchenLearn * 100),
    priceThreshold: persona.priceThreshold,
    runs: [],
    sprints: [],
    totalSmashes: 0,
    bestScore: 0,
    bestStreak: 0,
    discoveredChest: false,
    triedSprint: false,
    sawPaywall: false,
    converted: false,
    shared: false,
    returnedD1: false,
    churnedAfterRun: 0,
    churnReason: "",
    emotionalPeakRun: 0,
    maxEmotionalPeak: 0
  };

  let freeRunsLeft = CFG.freeRuns;
  let sprintFreeLeft = CFG.sprintFreeRuns;
  let isPremium = false;
  let runNumber = 0;

  // === FREE RUNS ===
  while (freeRunsLeft > 0) {
    runNumber++;
    freeRunsLeft--;

    const result = simulateRun(persona, runNumber, "RUN");
    journey.runs.push(result);
    journey.totalSmashes += result.smashes;
    journey.bestScore = Math.max(journey.bestScore, result.smashes);
    journey.bestStreak = Math.max(journey.bestStreak, result.maxStreak);

    if (result.emotionalPeak > journey.maxEmotionalPeak) {
      journey.maxEmotionalPeak = result.emotionalPeak;
      journey.emotionalPeakRun = runNumber;
    }

    // Chest discovery (after gate)
    if (runNumber > CFG.chestGateLanding && !journey.discoveredChest) {
      // Probability of noticing chest = curiosity * patience
      const noticeProb = persona.patience * 0.7;
      if (Math.random() < noticeProb) {
        journey.discoveredChest = true;
      }
    }

    // Sprint attempt (if discovered chest and has free sprints)
    if (journey.discoveredChest && !journey.triedSprint && sprintFreeLeft > 0) {
      sprintFreeLeft--;
      journey.triedSprint = true;
      const sprintResult = simulateRun(persona, runNumber, "SPRINT");
      journey.sprints.push(sprintResult);
      journey.totalSmashes += sprintResult.smashes;

      // Sprint is an emotional peak
      journey.maxEmotionalPeak = Math.max(journey.maxEmotionalPeak, sprintResult.emotionalPeak + 0.5);
    }

    // Early churn check: only if score=0 AND very impatient
    if (runNumber === 1 && result.smashes === 0 && persona.patience < 0.2) {
      journey.churnedAfterRun = 1;
      journey.churnReason = "confused_first_run";
      return journey;
    }

    // Share check (each run): share pride kicks in at modest scores
    if (!journey.shared && result.smashes >= 8) {
      if (Math.random() < persona.shareProb * (result.smashes / 15)) journey.shared = true;
    }
  }

  // === PAYWALL ===
  journey.sawPaywall = true;

  // Conversion decision
  const valuePerceived = (
    journey.maxEmotionalPeak * 0.3 +          // fun had
    (journey.triedSprint ? 0.15 : 0) +        // sprint discovery bonus
    (journey.bestScore / 50) * 0.2 +           // score investment
    (persona.pbAware ? 0.1 : 0) +             // cultural connection
    (persona.patience * 0.15)                   // willingness to invest
  );

  const priceBarrier = CFG.earlyPriceCents / persona.priceThreshold;
  const canPay = persona.age >= 18 || Math.random() < 0.3; // minors have ~30% card access
  const conversionProb = canPay ? clamp(valuePerceived - priceBarrier * 0.5, 0, 0.85) : 0;

  if (Math.random() < conversionProb) {
    journey.converted = true;
    isPremium = true;

    // Post-purchase: simulate 5 more runs
    for (let i = 0; i < 5; i++) {
      runNumber++;
      const result = simulateRun(persona, runNumber, "RUN");
      journey.runs.push(result);
      journey.totalSmashes += result.smashes;
      journey.bestScore = Math.max(journey.bestScore, result.smashes);
      journey.bestStreak = Math.max(journey.bestStreak, result.maxStreak);
    }

    // Post-purchase sprint
    const sprintResult = simulateRun(persona, runNumber, "SPRINT");
    journey.sprints.push(sprintResult);
    journey.totalSmashes += sprintResult.smashes;
  } else {
    // Didn't convert — maybe comes back?
    journey.churnedAfterRun = runNumber;

    if (journey.maxEmotionalPeak < 0.5) {
      journey.churnReason = "low_engagement";
    } else if (!canPay) {
      journey.churnReason = "no_payment_method";
    } else if (priceBarrier > 0.8) {
      journey.churnReason = "price_too_high";
    } else {
      journey.churnReason = "insufficient_value";
    }
  }

  // D1 return
  if (journey.converted || journey.maxEmotionalPeak > 1.0) {
    journey.returnedD1 = Math.random() < persona.returnD1;
  }

  return journey;
}

// ============================================
// GENERATE 100 PERSONAS
// ============================================
const personas = [];
let id = 0;

for (const arch of ARCHETYPES) {
  for (let i = 0; i < arch.count; i++) {
    id++;
    personas.push({
      id,
      archetype: arch.name,
      age: randInt(arch.age[0], arch.age[1]),
      reflex: rand(arch.reflex[0], arch.reflex[1]),
      patience: rand(arch.patience[0], arch.patience[1]),
      kitchenLearn: rand(arch.kitchenLearn[0], arch.kitchenLearn[1]),
      priceThreshold: randInt(arch.priceThreshold[0], arch.priceThreshold[1]),
      pbAware: Math.random() < rand(arch.pbAware[0], arch.pbAware[1]),
      shareProb: rand(arch.shareProb[0], arch.shareProb[1]),
      returnD1: rand(arch.returnD1[0], arch.returnD1[1])
    });
  }
}

// ============================================
// MONTE CARLO — Run 10 iterations, average
// ============================================
const ITERATIONS = 10;
const aggr = {
  converted: 0, shared: 0, returnedD1: 0, discoveredChest: 0,
  triedSprint: 0, sawPaywall: 0, earlyChurn: 0,
  avgBestScore: 0, avgBestStreak: 0, avgTotalSmashes: 0, avgRuns: 0,
  churnReasons: {},
  byArchetype: {}
};

for (const arch of ARCHETYPES) aggr.byArchetype[arch.name] = { conv: 0, share: 0, d1: 0, chest: 0, bestScore: 0, bestStreak: 0, n: arch.count * ITERATIONS };

for (let iter = 0; iter < ITERATIONS; iter++) {
  // Generate fresh personas each iteration
  const iterPersonas = [];
  let iid = 0;
  for (const arch of ARCHETYPES) {
    for (let i = 0; i < arch.count; i++) {
      iid++;
      iterPersonas.push({
        id: iid, archetype: arch.name,
        age: randInt(arch.age[0], arch.age[1]),
        reflex: rand(arch.reflex[0], arch.reflex[1]),
        patience: rand(arch.patience[0], arch.patience[1]),
        kitchenLearn: rand(arch.kitchenLearn[0], arch.kitchenLearn[1]),
        priceThreshold: randInt(arch.priceThreshold[0], arch.priceThreshold[1]),
        pbAware: Math.random() < rand(arch.pbAware[0], arch.pbAware[1]),
        shareProb: rand(arch.shareProb[0], arch.shareProb[1]),
        returnD1: rand(arch.returnD1[0], arch.returnD1[1])
      });
    }
  }

  const iterResults = iterPersonas.map(p => simulatePersona(p));
  
  aggr.converted += iterResults.filter(r => r.converted).length;
  aggr.shared += iterResults.filter(r => r.shared).length;
  aggr.returnedD1 += iterResults.filter(r => r.returnedD1).length;
  aggr.discoveredChest += iterResults.filter(r => r.discoveredChest).length;
  aggr.triedSprint += iterResults.filter(r => r.triedSprint).length;
  aggr.sawPaywall += iterResults.filter(r => r.sawPaywall).length;
  aggr.earlyChurn += iterResults.filter(r => r.churnedAfterRun === 1).length;
  aggr.avgBestScore += iterResults.reduce((s, r) => s + r.bestScore, 0) / 100;
  aggr.avgBestStreak += iterResults.reduce((s, r) => s + r.bestStreak, 0) / 100;
  aggr.avgTotalSmashes += iterResults.reduce((s, r) => s + r.totalSmashes, 0) / 100;
  aggr.avgRuns += iterResults.reduce((s, r) => s + r.runs.length, 0) / 100;

  iterResults.filter(r => !r.converted && r.churnReason).forEach(r => {
    aggr.churnReasons[r.churnReason] = (aggr.churnReasons[r.churnReason] || 0) + 1;
  });

  for (const r of iterResults) {
    const a = aggr.byArchetype[r.archetype];
    if (r.converted) a.conv++;
    if (r.shared) a.share++;
    if (r.returnedD1) a.d1++;
    if (r.discoveredChest) a.chest++;
    a.bestScore += r.bestScore;
    a.bestStreak += r.bestStreak;
  }
}

// Average over iterations
const N = ITERATIONS;
const T = 100; // per iteration

console.log("═══════════════════════════════════════════════════════════════");
console.log(`  KITCHEN RUSH — 100 PERSONA × ${ITERATIONS} ITERATIONS (Monte Carlo)`);
console.log("═══════════════════════════════════════════════════════════════");
console.log("");

console.log("FUNNEL (averaged per 100 players)");
console.log("─────────────────────────────────────────────────");
console.log(`  Played 1+ runs:        ${Math.round((T - aggr.earlyChurn / N))}/100`);
console.log(`  Early churn (run 1):   ${(aggr.earlyChurn / N).toFixed(1)}/100`);
console.log(`  Discovered chest:      ${(aggr.discoveredChest / N).toFixed(1)}/100`);
console.log(`  Tried Sprint:          ${(aggr.triedSprint / N).toFixed(1)}/100`);
console.log(`  Saw paywall:           ${(aggr.sawPaywall / N).toFixed(1)}/100`);
console.log(`  ★ Converted (paid):    ${(aggr.converted / N).toFixed(1)}/100  (${(aggr.converted / N / T * 100).toFixed(1)}%)`);
console.log(`  Shared score:          ${(aggr.shared / N).toFixed(1)}/100  (${(aggr.shared / N / T * 100).toFixed(1)}%)`);
console.log(`  Returned Day 1:        ${(aggr.returnedD1 / N).toFixed(1)}/100  (${(aggr.returnedD1 / N / T * 100).toFixed(1)}%)`);
console.log("");

console.log("ENGAGEMENT (averaged)");
console.log("─────────────────────────────────────────────────");
console.log(`  Avg best score:        ${(aggr.avgBestScore / N).toFixed(1)} Smashes`);
console.log(`  Avg best streak:       ${(aggr.avgBestStreak / N).toFixed(1)}`);
console.log(`  Avg total smashes:     ${(aggr.avgTotalSmashes / N).toFixed(0)}`);
console.log(`  Avg runs played:       ${(aggr.avgRuns / N).toFixed(1)}`);
console.log("");

console.log("CHURN REASONS (total across all iterations)");
console.log("─────────────────────────────────────────────────");
const sortedChurn = Object.entries(aggr.churnReasons).sort((a, b) => b[1] - a[1]);
for (const [reason, count] of sortedChurn) {
  const avg = count / N;
  const bar = "█".repeat(Math.round(avg / 2));
  console.log(`  ${reason.padEnd(25)} ${avg.toFixed(1).padStart(5)}/100  ${bar}`);
}
console.log("");

console.log("BY ARCHETYPE (averaged over iterations)");
console.log("─────────────────────────────────────────────────────────────────────────────────────");
console.log("  Archetype            N   Conv%   Share%  D1Ret%  AvgBest  AvgStrk  ChestDisc%");
console.log("  ─────────────────── ─── ─────── ─────── ─────── ──────── ──────── ──────────");

for (const arch of ARCHETYPES) {
  const a = aggr.byArchetype[arch.name];
  const n = arch.count;
  const totalN = n * N;
  console.log(`  ${arch.name.padEnd(20)} ${String(n).padStart(2)}   ${(a.conv/totalN*100).toFixed(0).padStart(4)}%   ${(a.share/totalN*100).toFixed(0).padStart(4)}%   ${(a.d1/totalN*100).toFixed(0).padStart(4)}%   ${(a.bestScore/totalN).toFixed(1).padStart(6)}   ${(a.bestStreak/totalN).toFixed(1).padStart(6)}   ${(a.chest/totalN*100).toFixed(0).padStart(6)}%`);
}

console.log("");

// Revenue
const convPer100 = aggr.converted / N;
const revenueEarlyBird = Math.round(convPer100 * 0.7) * 4.99;
const revenueStandard = Math.round(convPer100 * 0.3) * 6.99;
const gross = revenueEarlyBird + revenueStandard;
const net = gross * 0.97;

console.log("REVENUE PROJECTION");
console.log("─────────────────────────────────────────────────");
console.log(`  Avg conversions/100:   ${convPer100.toFixed(1)}`);
console.log(`  Revenue per 100:       $${gross.toFixed(2)} gross / $${net.toFixed(2)} net`);
console.log(`  Revenue per 1K users:  $${(net * 10).toFixed(2)}`);
console.log(`  Revenue per 10K users: $${(net * 100).toFixed(2)}`);
console.log(`  Revenue per 100K:      $${(net * 1000).toFixed(2)}`);
console.log("");

// Virality
const sharesPer100 = aggr.shared / N;
const viralReach = sharesPer100 * 3;
const viralInstalls = viralReach * 0.15;
const viralK = viralInstalls / 100;
console.log("VIRALITY");
console.log("─────────────────────────────────────────────────");
console.log(`  Shares per 100:        ${sharesPer100.toFixed(1)}`);
console.log(`  Viral coefficient K:   ${viralK.toFixed(3)}`);
console.log(`  K needed for growth:   >1.0`);
console.log(`  Verdict:               ${viralK > 0.5 ? "✅ Strong organic" : viralK > 0.1 ? "⚠ Weak organic, needs paid" : "❌ No organic growth"}`);
console.log("");

// Diagnostics
console.log("═══════════════════════════════════════════════════════════════");
console.log("  DIAGNOSTIC INSIGHTS (averaged)");
console.log("═══════════════════════════════════════════════════════════════");
console.log("");

const convRate = aggr.converted / N / T * 100;
const earlyChurnRate = aggr.earlyChurn / N;
const chestRate = aggr.discoveredChest / N;
const shareRate = aggr.shared / N;
const d1Rate = aggr.returnedD1 / N;
const noPay = (aggr.churnReasons.no_payment_method || 0) / N;
const priceTooHigh = (aggr.churnReasons.price_too_high || 0) / N;
const lowEngage = (aggr.churnReasons.low_engagement || 0) / N;

if (convRate >= 10) console.log("  ✅ CONVERSION ≥10% — excellent");
else if (convRate >= 5) console.log("  ✅ CONVERSION 5-10% — healthy for casual game one-time purchase");
else if (convRate >= 3) console.log("  ⚠ CONVERSION 3-5% — below average, review paywall");
else console.log("  ❌ CONVERSION <3% — critical problem");

if (earlyChurnRate > 10) console.log("  ⚠ EARLY CHURN " + earlyChurnRate.toFixed(0) + "% — onboarding failing");
if (chestRate < 50) console.log("  ⚠ CHEST DISCOVERY " + chestRate.toFixed(0) + "% — hint too subtle");
if (shareRate < 10) console.log("  ⚠ SHARE RATE " + shareRate.toFixed(0) + "% — share CTA needs work");
if (noPay > 8) console.log("  ⚠ NO PAYMENT METHOD " + noPay.toFixed(0) + "/100 — consider gift codes");
if (priceTooHigh > 20) console.log("  ⚠ PRICE TOO HIGH " + priceTooHigh.toFixed(0) + "/100 — consider $2.99 tier");
if (lowEngage > 15) console.log("  ⚠ LOW ENGAGEMENT " + lowEngage.toFixed(0) + "/100 — needs more hooks in free runs");
if (d1Rate < 20) console.log("  ⚠ D1 RETURN " + d1Rate.toFixed(0) + "% — no recall mechanism");

if (shareRate >= 15) console.log("  ✅ SHARE ≥15% — viral loop potential");
if (d1Rate >= 30) console.log("  ✅ D1 RETURN ≥30% — good retention");

console.log("");
console.log("  KEY RECOMMENDATIONS:");
if (priceTooHigh > 20) console.log("  1. Price is #1 churn reason → test $2.99 early bird");
if (lowEngage > 15) console.log("  2. Low engagement → first run needs stronger hook (tutorial?)");
if (shareRate < 10) console.log("  3. Share rate low → auto-show share card on END screen");
if (noPay > 8) console.log("  4. " + noPay.toFixed(0) + " users can't pay → implement gift codes for minors");
if (chestRate < 60) console.log("  5. Chest discovery " + chestRate.toFixed(0) + "% → make hint more explicit");
if (d1Rate < 20) console.log("  6. D1 return " + d1Rate.toFixed(0) + "% → enable daily challenge mode");
console.log("");
