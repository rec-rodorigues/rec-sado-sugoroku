// =====================================================
// 効果音・BGM
// ブラウザの機能（Web Audio）で音を作って鳴らす。音のファイルはいらない。
// =====================================================

// 無料素材サイトの音に差し替えたいときは、利用規約を確認してから sounds/ に置き、ここに書く。
// 書いた音はファイルを鳴らし、書いていない音はブラウザで作った音を鳴らす。
//   例：hop: "sounds/hop.mp3",  bgm: "sounds/bgm.mp3"
var SOUND_FILES = {
  // hop: "sounds/hop.mp3",
  // bgm: "sounds/bgm.mp3",
};

var Sound = (function () {
  "use strict";

  var ctx = null;
  var on = true;
  var bgmTimer = null, bgmAudio = null;
  try { on = localStorage.getItem("sado-sound") !== "off"; } catch (e) { /* 保存できなくても動く */ }

  function audio() {
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // 1つの音（高さ freq、start 秒後から dur 秒）
  function tone(c, freq, start, dur, type, vol, slideTo) {
    var t = c.currentTime + start;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || "triangle";
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // ザッという音（サイコロ・紙吹雪）
  function noise(c, start, dur, vol, freq) {
    var t = c.currentTime + start;
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf;
    f.type = "bandpass";
    f.frequency.value = freq || 1800;
    g.gain.value = vol || 0.15;
    s.connect(f).connect(g).connect(c.destination);
    s.start(t);
  }

  var N = { C4: 262, D4: 294, E4: 330, G4: 392, A4: 440, C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, C6: 1047 };

  var SFX = {
    click: function (c) { tone(c, 660, 0, 0.06, "triangle", 0.08); },
    dice: function (c) {
      for (var i = 0; i < 9; i++) noise(c, i * 0.15 + Math.random() * 0.05, 0.05, 0.12, 1500 + Math.random() * 1500);
    },
    diceStop: function (c) { noise(c, 0, 0.08, 0.2, 900); tone(c, N.G5, 0.05, 0.12, "triangle", 0.1); },
    hop: function (c, n) { tone(c, 520 + (n || 0) * 45, 0, 0.1, "square", 0.05, 760 + (n || 0) * 45); },
    pass: function (c) { tone(c, N.A5, 0, 0.12, "triangle", 0.08); tone(c, N.C6 * 1.12, 0.1, 0.18, "triangle", 0.08); },
    reveal: function (c) { [N.C5, N.E5, N.G5, N.C6].forEach(function (f, i) { tone(c, f, i * 0.07, 0.18, "triangle", 0.09); }); },
    tick: function (c) { tone(c, 1320, 0, 0.03, "square", 0.025); },
    plus: function (c) { tone(c, N.E5, 0, 0.1, "triangle", 0.1); tone(c, N.A5, 0.09, 0.22, "triangle", 0.1); },
    minus: function (c) { tone(c, N.E4, 0, 0.16, "sawtooth", 0.05, N.C4); tone(c, N.C4, 0.16, 0.26, "sawtooth", 0.05, 200); },
    zero: function (c) { tone(c, N.G4, 0, 0.15, "triangle", 0.07); },
    coin: function (c) { tone(c, N.E5 * 1.5, 0, 0.08, "square", 0.04); tone(c, N.A5 * 1.5, 0.07, 0.2, "square", 0.04); },
    goal: function (c) {
      [N.G4, N.C5, N.E5, N.G5].forEach(function (f, i) { tone(c, f, i * 0.12, 0.2, "square", 0.05); });
      [N.C5, N.E5, N.G5, N.C6].forEach(function (f) { tone(c, f, 0.5, 0.7, "triangle", 0.05); });
    },
    drum: function (c) { for (var i = 0; i < 10; i++) noise(c, i * 0.05, 0.05, 0.1 + i * 0.01, 300); },
    podium: function (c) { tone(c, N.C5, 0, 0.12, "square", 0.05); tone(c, N.G5, 0.1, 0.25, "square", 0.05); },
    fanfare: function (c) {
      var m = [[N.G4, 0, 0.15], [N.G4, 0.16, 0.15], [N.G4, 0.32, 0.15], [N.C5, 0.48, 0.5], [N.A4, 1.0, 0.25], [N.C5, 1.26, 0.2], [N.E5, 1.48, 0.9]];
      m.forEach(function (x) { tone(c, x[0], x[1], x[2], "square", 0.06); tone(c, x[0] / 2, x[1], x[2], "triangle", 0.05); });
      noise(c, 1.48, 0.9, 0.05, 4000);
    }
  };

  function play(name, arg) {
    if (!on) return;
    if (SOUND_FILES[name]) {
      try { new Audio(SOUND_FILES[name]).play(); } catch (e) { /* 鳴らなくても止めない */ }
      return;
    }
    var c = audio();
    if (c && SFX[name]) SFX[name](c, arg);
  }

  // BGM：のんびりした五音音階のメロディ（このゲームのためのオリジナル）
  var MELODY = [
    [N.E5, 1], [N.G5, 1], [N.A5, 2], [N.G5, 1], [N.E5, 1], [N.D5, 2],
    [N.E5, 1], [N.D5, 1], [N.C5, 1], [N.A4, 1], [N.C5, 2], [0, 2],
    [N.D5, 1], [N.E5, 1], [N.G5, 2], [N.A5, 1], [N.G5, 1], [N.E5, 2],
    [N.D5, 1], [N.C5, 1], [N.D5, 1], [N.E5, 1], [N.C5, 3], [0, 1]
  ];
  var BASS = [N.C4 / 2, N.A4 / 4, N.D4 / 2, N.G4 / 4];
  var BEAT = 0.3;

  function startBgm() {
    if (!on || bgmTimer || bgmAudio) return;
    if (SOUND_FILES.bgm) {
      bgmAudio = new Audio(SOUND_FILES.bgm);
      bgmAudio.loop = true;
      bgmAudio.volume = 0.3;
      bgmAudio.play().catch(function () {});
      return;
    }
    var c = audio();
    if (!c) return;
    var total = MELODY.reduce(function (s, m) { return s + m[1]; }, 0) * BEAT;
    function loop() {
      var t = 0;
      MELODY.forEach(function (m) {
        if (m[0]) tone(c, m[0], t, m[1] * BEAT * 0.9, "triangle", 0.025);
        t += m[1] * BEAT;
      });
      for (var i = 0; i < 8; i++) tone(c, BASS[i % 4], i * total / 8, total / 8 * 0.8, "sine", 0.03);
    }
    loop();
    bgmTimer = setInterval(loop, total * 1000);
  }

  function stopBgm() {
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    if (bgmAudio) { bgmAudio.pause(); bgmAudio = null; }
  }

  return {
    play: play,
    startBgm: startBgm,
    stopBgm: stopBgm,
    unlock: audio, // ボタンを押したときに呼ぶ（ブラウザは操作のあとでないと音を出さない）
    isOn: function () { return on; },
    setOn: function (v) {
      on = v;
      try { localStorage.setItem("sado-sound", v ? "on" : "off"); } catch (e) { /* 保存できなくても動く */ }
      if (!v) stopBgm();
    }
  };
})();
