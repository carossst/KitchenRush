// audio.js v1.0 - Kitchen Rush
// Procedural Web Audio API synthesis — zero external audio files.
// Sounds: smash (pickleball pop), fault, bounce, miss, gameOver, sprintBuzzer, milestone.

(() => {
  "use strict";

  let _ctx = null;
  let _unlocked = false;

  function getCtx() {
    if (_ctx) return _ctx;
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) { return null; }
    return _ctx;
  }

  // Unlock AudioContext on first user gesture (iOS/Chrome requirement)
  function unlock() {
    if (_unlocked) return;
    var ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    // Create silent buffer to fully unlock
    var buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    _unlocked = true;
  }


  // ============================================
  // Sound generators
  // ============================================

  /**
   * Smash — realistic pickleball "pop/crack" (65-75dB feel)
   * Layered: sharp noise crack + midrange resonant pop + bass thump
   * The signature pop-pop-pop sound of a hard paddle hitting plastic ball
   */
  function playSmash(volume, pitch) {
    var ctx = getCtx();
    if (!ctx) return;
    var vol = Number(volume) || 0.6;
    var p = Number(pitch) || 1;
    var t = ctx.currentTime;

    // Layer 1: Sharp noise crack (the "hit" transient — 15ms, very short)
    var crackDur = 0.015;
    var crackLen = Math.ceil(ctx.sampleRate * crackDur);
    var crackBuf = ctx.createBuffer(1, crackLen, ctx.sampleRate);
    var crackData = crackBuf.getChannelData(0);
    for (var i = 0; i < crackLen; i++) {
      // Shaped noise: loud start, instant decay
      crackData[i] = (Math.random() * 2 - 1) * (1 - i / crackLen);
    }
    var crackSrc = ctx.createBufferSource();
    crackSrc.buffer = crackBuf;

    // Band-pass to focus on the "crack" frequencies (2-6kHz)
    var crackBp = ctx.createBiquadFilter();
    crackBp.type = "bandpass";
    crackBp.frequency.value = 3500 * p;
    crackBp.Q.value = 1.2;

    var crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(vol * 0.9, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + crackDur);

    crackSrc.connect(crackBp);
    crackBp.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackSrc.start(t);
    crackSrc.stop(t + crackDur + 0.01);

    // Layer 2: Midrange resonant "pop" (the body of the sound — 30ms)
    var popOsc = ctx.createOscillator();
    popOsc.type = "sine";
    popOsc.frequency.setValueAtTime(1800 * p, t);
    popOsc.frequency.exponentialRampToValueAtTime(600 * p, t + 0.03);

    var popGain = ctx.createGain();
    popGain.gain.setValueAtTime(vol * 0.55, t);
    popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    popOsc.connect(popGain);
    popGain.connect(ctx.destination);
    popOsc.start(t);
    popOsc.stop(t + 0.04);

    // Layer 3: Second harmonic click (adds the "plastic" character)
    var clickOsc = ctx.createOscillator();
    clickOsc.type = "triangle";
    clickOsc.frequency.setValueAtTime(2800 * p, t);
    clickOsc.frequency.exponentialRampToValueAtTime(1000 * p, t + 0.02);

    var clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(vol * 0.3, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(t);
    clickOsc.stop(t + 0.03);

    // Layer 4: Sub bass thump (gives physical weight)
    var sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(100 * p, t);
    sub.frequency.exponentialRampToValueAtTime(50, t + 0.06);
    var subGain = ctx.createGain();
    subGain.gain.setValueAtTime(vol * 0.3, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(t);
    sub.stop(t + 0.09);
  }

  /**
   * Fault — low thud with dissonance (clearly "wrong")
   */
  function playFault(volume) {
    var ctx = getCtx();
    if (!ctx) return;
    var vol = Number(volume) || 0.4;
    var t = ctx.currentTime;

    // Low thud
    var osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    // Low-pass to soften
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 400;

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  /**
   * Bounce — bright "ping" (ball hitting ground, signals "NOW you can hit")
   */
  function playBounce(volume) {
    var ctx = getCtx();
    if (!ctx) return;
    var vol = Number(volume) || 0.3;
    var t = ctx.currentTime;

    var osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.08);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.11);

    // Second harmonic for richness
    var osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1320, t);
    osc2.frequency.exponentialRampToValueAtTime(660, t + 0.06);
    var gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(vol * 0.25, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t);
    osc2.stop(t + 0.08);
  }

  /**
   * Miss — soft descending tone (disappointment)
   */
  function playMiss(volume) {
    var ctx = getCtx();
    if (!ctx) return;
    var vol = Number(volume) || 0.25;
    var t = ctx.currentTime;

    var osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.2);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  /**
   * Game Over — deep final chord (two descending tones)
   */
  function playGameOver(volume) {
    var ctx = getCtx();
    if (!ctx) return;
    var vol = Number(volume) || 0.5;
    var t = ctx.currentTime;

    [220, 165].forEach(function (freq, idx) {
      var osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.6);

      var gain = ctx.createGain();
      var delay = idx * 0.08;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(vol * 0.6, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + 0.65);
    });
  }

  /**
   * Sprint Buzzer — sharp high buzz (timer end)
   */
  function playSprintBuzzer(volume) {
    var ctx = getCtx();
    if (!ctx) return;
    var vol = Number(volume) || 0.45;
    var t = ctx.currentTime;

    // Two short beeps
    for (var i = 0; i < 2; i++) {
      var osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = 880;

      var gain = ctx.createGain();
      var start = t + i * 0.15;
      gain.gain.setValueAtTime(vol * 0.5, start);
      gain.gain.setValueAtTime(0.001, start + 0.08);

      // Bandpass to soften
      var bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 880;
      bp.Q.value = 5;

      osc.connect(bp);
      bp.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.1);
    }
  }

  /**
   * Milestone — ascending chime (positive, brief, non-interrupting)
   */
  function playMilestone(volume) {
    var ctx = getCtx();
    if (!ctx) return;
    var vol = Number(volume) || 0.35;
    var t = ctx.currentTime;

    [523, 659, 784].forEach(function (freq, idx) {
      var osc = ctx.createOscillator();
      osc.type = "sine";
      var start = t + idx * 0.06;
      osc.frequency.value = freq;

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.5, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.16);
    });
  }

  /**
   * New Best — celebratory ascending arpeggio
   */
  function playNewBest(volume) {
    var ctx = getCtx();
    if (!ctx) return;
    var vol = Number(volume) || 0.4;
    var t = ctx.currentTime;

    [523, 659, 784, 1047].forEach(function (freq, idx) {
      var osc = ctx.createOscillator();
      osc.type = "sine";
      var start = t + idx * 0.08;
      osc.frequency.value = freq;

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.5, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.22);
    });
  }


  // ============================================
  // Public API
  // ============================================
  window.KR_Audio = {
    unlock: unlock,
    play: function (type, volume, pitch) {
      var p = Number(pitch) || 1;
      switch (type) {
        case "smash":        playSmash(volume, p); break;
        case "fault":        playFault(volume); break;
        case "bounce":       playBounce(volume); break;
        case "miss":         playMiss(volume); break;
        case "gameOver":     playGameOver(volume); break;
        case "sprintBuzzer": playSprintBuzzer(volume); break;
        case "milestone":    playMilestone(volume); break;
        case "newBest":      playNewBest(volume); break;
        default: break;
      }
    }
  };
})();
