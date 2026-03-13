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
   * Smash — short bright "pop" (pickleball paddle sound)
   * White noise burst + high-pass filter + fast decay
   */
  function playSmash(volume, pitch) {
    var ctx = getCtx();
    if (!ctx) return;
    var vol = Number(volume) || 0.6;
    var p = Number(pitch) || 1;
    var t = ctx.currentTime;

    // Noise burst (40ms)
    var dur = 0.04;
    var bufLen = Math.ceil(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);

    var src = ctx.createBufferSource();
    src.buffer = buf;

    // High-pass filter (makes it sound like plastic impact)
    var hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2000 * p;

    // Envelope
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur);

    // Tonal "click" layered on top (adds the satisfying snap)
    var osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200 * p, t);
    osc.frequency.exponentialRampToValueAtTime(400 * p, t + 0.03);
    var oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(vol * 0.4, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
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
   * Bounce — soft short "toc" (ball hitting ground)
   */
  function playBounce(volume) {
    var ctx = getCtx();
    if (!ctx) return;
    var vol = Number(volume) || 0.3;
    var t = ctx.currentTime;

    var osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.05);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
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
