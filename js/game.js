// =====================================================
// ゲームの進行・イベント・演出
// =====================================================

(function () {
  "use strict";

  // コマ。image の絵を差し替えればキャラクターが変わる（color はプレイヤーの色）
  var KOMA = [
    { name: "トキ", color: "#e8708e", image: "images/koma/toki.svg" },
    { name: "たらいぶね", color: "#2f6fc8", image: "images/koma/tarai.svg" },
    { name: "金のかたまり", color: "#8e5cc4", image: "images/koma/kin.svg" },
    { name: "おにぎり", color: "#3a9d5d", image: "images/koma/onigiri.svg" }
  ];

  // マスの種類の名前（カードの上に出る）
  var BADGES = { place: "めいしょ", lucky: "ラッキー", quiz: "クイズ", happening: "ハプニング", move: "すすむ・もどる", toki: "レア！", unknown: "？",
    card: "カード", rival: "かけひき", fork: "分かれ道", dice2: "サイコロ2こ" };

  var GOAL_BONUS = [150, 120, 80, 50]; // 1着・2着・3着・4着
  var TOKI_MAX = 2;       // 野生のトキは 1人 2回まで
  var WAITING_BONUS = 5;    // ゴールした人がサイコロをふったときの「出た目 × 5てん」
  var WAITING_ONE = -10;   // ただし 1 が出たら −10てん
  var STEP_MS = 300;   // 1マス進む時間
  var DICE_MS = 1700;  // サイコロが転がっている時間
  var PASS_MS = 2000;  // 名所を通りすぎたときのカードを出しておく時間
  var PIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  // サイコロの目 n を正面に向けるための回転（X, Y）
  // 目 n を 上の面に むける 回転 [rotateX, rotateY]
  var DICE_FACE = { 1: [90, 0], 2: [90, -90], 3: [0, 0], 4: [180, 0], 5: [90, 90], 6: [-90, 0] };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function placeName(sq) {
    return sq.yomi ? "<ruby>" + esc(sq.name) + "<rt>" + esc(sq.yomi) + "</rt></ruby>" : esc(sq.name);
  }

  // ---------- モード（こども・おとな）ごとのデータ ----------
  // おとなモードは、こどもモードのイベント・クイズに data/adult/ のものを足して使う
  var COAST_KM = 1.0; // 海岸に近いマス（海岸線から 約1km 以内）
  var HAND_MAX = 3;   // カードは 1人 3まいまで

  function buildMode(rawSquares, rawEvents, quizzes, quizProblems, file, label) {
    var cs = checkSquares(rawSquares, file, label);
    var ce = checkEvents(rawEvents, cs.squares, label);
    return {
      rawSquares: rawSquares, squares: cs.squares, events: ce.events, quizzes: quizzes,
      coastal: (cs.squares || []).map(function (s) { return Roads.coastDistanceKm(s.lat, s.lng) <= COAST_KM; }),
      problems: cs.problems.concat(ce.problems, quizProblems)
    };
  }
  function mergeEvents(a, b) {
    a = a || {};
    b = b || {};
    var out = { wildToki: a.wildToki };
    ["places", "lucky", "happening", "move", "fixed", "cards", "rival"].forEach(function (k) {
      out[k] = (Array.isArray(a[k]) ? a[k] : []).concat(Array.isArray(b[k]) ? b[k] : []);
    });
    return out;
  }
  var kidsQuizzes = checkQuizzes(window.QUIZZES);
  var adultQuizzes = checkQuizzes(window.ADULT_QUIZZES, "data/adult/quizzes.js");
  var MODES = {
    kids: buildMode(window.SQUARES, window.EVENTS, kidsQuizzes.quizzes, kidsQuizzes.problems, "data/squares.js", ""),
    adult: buildMode(window.ADULT_SQUARES, mergeEvents(window.EVENTS, window.ADULT_EVENTS),
      kidsQuizzes.quizzes.concat(adultQuizzes.quizzes), adultQuizzes.problems, "data/adult/squares.js", "おとなモードの ")
  };

  // いま遊んでいるモードのデータ（setMode で切りかえる）
  var mode, squares, events, quizzes, coastal;
  function setMode(key) {
    mode = key;
    var m = MODES[key];
    squares = m.squares;
    events = m.events;
    quizzes = m.quizzes;
    coastal = m.coastal;
    document.body.classList.toggle("mode-adult", key === "adult");
  }
  setMode("kids");
  function isAdult() { return mode === "adult"; }

  var setup = { count: 2, mode: "kids", players: [0, 1, 2, 3].map(function (i) { return { name: "", koma: i }; }) };
  var game = null;
  var map = null;
  var diceState = [{ x: 0, y: 0 }, { x: 0, y: 0 }];

  // あとで止められるタイマー（「つぎへ」が早く押されたときや、やり直しのときに止める）
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // ---------- 画面切りかえ ----------

  function showScreen(id) {
    ["title-screen", "game-screen", "result-screen"].forEach(function (s) {
      $(s).classList.toggle("active", s === id);
    });
  }

  // ---------- データの問題の表示 ----------

  function showProblems(list) {
    if (!list.length) return;
    var box = $("data-problems");
    box.innerHTML = '<div class="dp-head"><strong>データの確認</strong><button type="button" id="dp-close">とじる</button></div>' +
      "<ul>" + list.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>";
    box.hidden = false;
    $("dp-close").addEventListener("click", function () { box.hidden = true; });
  }

  // ---------- 音のボタン ----------

  function renderSoundButton() {
    var b = $("sound-button");
    var on = Sound.isOn();
    b.classList.toggle("off", !on);
    b.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">' +
      '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' +
      (on ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        : '<path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>') +
      "</svg><span>おと " + (on ? "ON" : "OFF") + "</span>";
  }

  // ---------- タイトル画面 ----------

  function renderSetup() {
    var cb = $("count-buttons");
    cb.innerHTML = "";
    [2, 3, 4].forEach(function (n) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "count-button" + (n === setup.count ? " selected" : "");
      b.innerHTML = n + "<small>人</small>";
      b.addEventListener("click", function () { Sound.play("click"); setup.count = n; renderSetup(); });
      cb.appendChild(b);
    });

    // モード：こども（これまでの すごろく）／おとな（分かれ道・カード・かけひき）
    var mb = $("mode-buttons");
    mb.innerHTML = "";
    [["kids", "こども", "40マス・5分くらい"], ["adult", "おとな", "56マス・分かれ道・カード・かけひき"]].forEach(function (m) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mode-button mode-" + m[0] + (setup.mode === m[0] ? " selected" : "");
      b.disabled = !MODES[m[0]].squares;
      b.innerHTML = "<b>" + m[1] + "</b><small>" + m[2] + "</small>";
      b.addEventListener("click", function () { Sound.play("click"); setup.mode = m[0]; renderSetup(); });
      mb.appendChild(b);
    });

    // 人数をふやしたときにコマがかぶったら、あいているコマにする
    var used = [];
    for (var i = 0; i < setup.count; i++) {
      var p = setup.players[i];
      if (used.indexOf(p.koma) >= 0) {
        for (var k = 0; k < KOMA.length; k++) if (used.indexOf(k) < 0) { p.koma = k; break; }
      }
      used.push(p.koma);
    }

    var box = $("player-setup");
    box.innerHTML = "";
    setup.players.slice(0, setup.count).forEach(function (p, i) {
      var row = document.createElement("div");
      row.className = "player-row";
      row.innerHTML = '<span class="player-num" style="background:' + KOMA[p.koma].color + '">' + (i + 1) + "</span>";

      var input = document.createElement("input");
      input.type = "text";
      input.maxLength = 8;
      input.placeholder = "プレイヤー" + (i + 1);
      input.value = p.name;
      input.addEventListener("input", function () { p.name = input.value; });
      row.appendChild(input);

      KOMA.forEach(function (koma, k) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "koma-button" + (p.koma === k ? " selected" : "");
        b.disabled = p.koma !== k && used.indexOf(k) >= 0;
        b.innerHTML = komaIcon(koma, 40) + "<span>" + esc(koma.name) + "</span>";
        b.addEventListener("click", function () { Sound.play("click"); p.koma = k; renderSetup(); });
        row.appendChild(b);
      });
      box.appendChild(row);
    });

    $("start-button").disabled = !MODES[setup.mode].squares;
  }

  // ---------- ゲーム ----------

  function startGame() {
    if (!MODES[setup.mode].squares) return;
    setMode(setup.mode);
    Sound.unlock();
    Sound.play("click");
    clearTimers();
    bags = {};
    game = { players: [], turn: 0, finished: 0, busy: false, doubleNow: false };
    setup.players.slice(0, setup.count).forEach(function (p, i) {
      game.players.push({
        name: p.name.trim() || "プレイヤー" + (i + 1),
        koma: KOMA[p.koma],
        pos: 0,           // いるマスの id
        trail: [],        // 通ってきたマス（もどるときに使う）
        home: false,      // 一周して 両津港に もどった
        points: 0,
        shown: 0,         // スコアボードに出しているポイント（カウントアップのため）
        finishOrder: null, // ゴールした順番（0 = 1着）
        seasick: false,   // 船よい：つぎの番で すすむマスが 1 へる
        tokiUp: false,    // I♥佐渡：野生のトキに 会える かくりつが 上がる
        tokiCount: 0,     // 野生のトキに 会った回数（1人 2回まで）
        // ここから おとなモード
        cards: [],        // 手札（3まいまで）
        twoDice: false,   // つぎの番は サイコロ2こ
        boost: 0,         // つぎの番は 出た目に たす
        double: false     // つぎの番で 止まったマスの ポイントが 2ばい
      });
    });

    if (map) map.destroy();
    showScreen("game-screen");
    map = MapView.create($("map"), $("minimap"), $("map-offline"), squares, game.players);
    hideCard();
    $("dice-result").textContent = "";
    render();
    Sound.startBgm();
  }

  function cur() { return game.players[game.turn]; }

  function render() {
    var p = cur();
    var banner = $("turn-banner");
    banner.style.background = p.koma.color;
    var done = p.finishOrder !== null;
    $("turn-text").innerHTML = komaIcon(p.koma, 52) + "<span>" + esc(p.name) + "さんの 番" + (done ? "<small class='turn-done'>ゴールずみ</small>" : "") + "</span>";
    var notes = [];
    if (!done && p.twoDice) notes.push("サイコロ2こ");
    if (!done && p.boost) notes.push("出た目 +" + p.boost);
    if (!done && p.double) notes.push("ポイント2ばい");
    $("roll-button").innerHTML = done ? "サイコロを ふる<small>出た目 × " + WAITING_BONUS + "てん（1は −10）</small>"
      : "サイコロを ふる" + (notes.length ? "<small>" + notes.join("・") + "</small>" : "");
    banner.classList.remove("turn-pop");
    void banner.offsetWidth;
    banner.classList.add("turn-pop");
    renderScoreboard();
    renderHand();
    $("roll-button").disabled = game.busy;
    // 地図で何かあっても、ゲームは止めない
    try {
      map.setActive(game.turn);
      map.showSquares(aheadOf(p.pos, 6));
    } catch (e) {
      console.error(e);
    }
  }

  function currentRank(p) {
    return 1 + game.players.filter(function (q) { return q.shown > p.shown; }).length;
  }

  function renderScoreboard() {
    $("scoreboard").innerHTML = game.players.map(function (p, i) {
      return '<li class="' + (i === game.turn ? "current" : "") + '" style="--pc:' + p.koma.color + '">' +
        komaIcon(p.koma, 40) +
        '<span class="sb-name">' + esc(p.name) +
        (p.finishOrder !== null ? '<em class="sb-goal">ゴール</em>' : "") +
        (p.seasick ? '<em class="sb-tag sick">ふなよい</em>' : "") +
        (p.tokiUp ? '<em class="sb-tag toki">I♥さど</em>' : "") + "</span>" +
        '<span class="sb-points" id="sb-points-' + i + '">' + p.shown + "<small>てん</small></span>" +
        '<span class="sb-rank">' + currentRank(p) + "ばん" +
        (isAdult() ? '<em class="sb-tag cards">カード ' + p.cards.length + "まい</em>" : "") + "</span></li>";
    }).join("");
  }

  // ---------- サイコロ（CSSの3D） ----------

  function buildDice() {
    var html = "";
    for (var n = 1; n <= 6; n++) {
      html += '<div class="face f' + n + '">';
      for (var i = 0; i < 9; i++) {
        html += '<span class="pip' + (PIPS[n].indexOf(i) >= 0 ? " on" : "") + (n === 1 ? " red" : "") + '"></span>';
      }
      html += "</div>";
    }
    $("dice").innerHTML = html;
    $("dice2").innerHTML = html;
  }

  // 目 n が上の面に来るように、何回転かしてから止める（k = 1 は 2こ目のサイコロ）
  function spinDiceTo(n, k) {
    var f = DICE_FACE[n], d = diceState[k || 0];
    d.x = Math.ceil((d.x + 720) / 360) * 360 + f[0];
    d.y = Math.ceil((d.y + 1080) / 360) * 360 + f[1];
    $(k ? "dice2" : "dice").style.transform = "rotateX(" + d.x + "deg) rotateY(" + d.y + "deg)";
  }

  // サイコロを転がして、止まった目を done(n) にわたす。two のときは 2こ ふって done(n, m)
  function rollDice(done, two) {
    var n = 1 + Math.floor(Math.random() * 6);
    var m = 1 + Math.floor(Math.random() * 6);
    $("dice-scene2").hidden = !two;
    var scenes = two ? [$("dice-scene"), $("dice-scene2")] : [$("dice-scene")];
    scenes.forEach(function (s) { s.classList.remove("landed"); s.classList.add("rolling"); });
    Sound.play("dice");
    spinDiceTo(n, 0);
    if (two) spinDiceTo(m, 1);
    later(function () {
      scenes.forEach(function (s) { s.classList.remove("rolling"); s.classList.add("landed"); });
      Sound.play("diceStop");
      done(n, m);
    }, DICE_MS);
  }

  // マス i から 進めるマス（分かれ道なら 2つ以上。0 はゴール）
  function nextOf(i) { return squareNexts(squares, i); }

  // pos から先、n マスぶんのマスの番号（ゴール・「かならず止まる」マス・分かれ道で切る）。カメラ合わせに使う
  function aheadOf(pos, n) {
    var list = [pos];
    var q = pos;
    for (var k = 1; k <= n; k++) {
      var nx = nextOf(q);
      if (nx.length > 1) { list = list.concat(nx); break; }
      q = nx[0];
      list.push(q);
      if (q === 0 || squares[q].stop) break;
    }
    return list;
  }

  function roll() {
    if (!game || game.busy) return;
    game.busy = true;
    $("roll-button").disabled = true;
    renderHand();
    // サイコロをふったら地図は動かせなくする
    map.setInteractive(false);
    $("dice-result").textContent = "";
    var p = cur();

    // ゴールした人：コマは動かさず、出た目 × 5てん
    if (p.finishOrder !== null) {
      p.twoDice = false;
      p.boost = 0;
      p.double = false;
      rollDice(function (n) {
        $("dice-result").innerHTML = n === 1 ? "<b>1</b> … −10てん" : "<b>" + n + "</b> × " + WAITING_BONUS + "てん！";
        showBigNumber(n, n === 1 ? "ざんねん… −10てん" : "× " + WAITING_BONUS + "てん！");
        later(function () { waitingBonus(n); }, 700);
      });
      return;
    }

    var two = p.twoDice;
    p.twoDice = false;
    rollDice(function (n, m) {
      if (!two) return moveBy(n);
      // サイコロ2こ：好きな方の目を えらぶ
      pickDie(n, m, moveBy);
    }, two);
  }

  // 出た目 n で進む（船よい・おいかぜを 足し引きする）
  function moveBy(n) {
    var p = cur();
    var steps = n;
    var calc = [], why = [];
    // 船よい：1 へる（1が出たときは 1マス）
    if (p.seasick) {
      p.seasick = false;
      steps = Math.max(1, steps - 1);
      calc.push("− 1");
      why.push("ふなよい");
    }
    if (p.boost) {
      steps += p.boost;
      calc.push("+ " + p.boost);
      why.push("おいかぜ");
      p.boost = 0;
    }
    var label = calc.length ? calc.join(" ") + " ＝ " + steps + "マス（" + why.join("・") + "）" : "マス すすむ！";
    renderScoreboard();
    $("dice-result").innerHTML = "<b>" + n + "</b> " + (steps !== n ? "→ " + steps + "マス" : "マス すすむ！");
    showBigNumber(n, label);
    // これから通るマスが ぜんぶ見えるように カメラを合わせる
    map.showSquares(aheadOf(p.pos, steps));
    later(function () { walk(steps, arrive); }, 900);
  }

  // サイコロ2この どちらを 使うか えらぶ
  function pickDie(n, m, fn) {
    $("dice-result").innerHTML = "<b>" + n + "</b> と <b>" + m + "</b>";
    openCard({
      type: "dice2", title: "どっちの 目を 使う？",
      body: '<div class="die-choices">' + [n, m].map(function (v) {
        return '<button type="button" class="die-choice" data-v="' + v + '">' + v + "</button>";
      }).join("") + "</div>"
    });
    Array.prototype.forEach.call($("card-body").querySelectorAll(".die-choice"), function (b) {
      b.addEventListener("click", function () {
        Sound.play("click");
        hideCard();
        fn(Number(b.dataset.v));
      }, { once: true });
    });
  }

  // 止まった目を地図の上に大きく出す
  function showBigNumber(n, label) {
    var el = $("big-number");
    el.innerHTML = "<b>" + n + "</b><span>" + label + "</span>";
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }

  // ---------- コマの移動 ----------

  // steps マス進む（マイナスならもどる）。おわったら done
  // 進むときは、ゴールと「かならず止まる」マスで止まり、分かれ道では どちらに行くか えらぶ。
  // もどるときは 来た道を もどる（スタートまでは もどらない）
  function walk(steps, done) {
    var p = cur();
    var i = game.turn;
    var dir = steps > 0 ? 1 : -1;
    var left = Math.abs(steps);
    var hop = 0;
    map.setInteractive(false);

    function moveTo(idx) {
      p.pos = idx;
      left--;
      map.moveKoma(i, idx);
      map.follow(idx);
      Sound.play("hop", dir > 0 ? hop++ : -(hop++));
    }
    function forward(to) {
      p.trail.push(p.pos);
      moveTo(to);
      if (to === 0) {
        p.home = true; // 一周して 両津港に もどった＝ゴール
        left = 0;
      } else {
        if (squares[to].stop && left > 0) {
          left = 0;
          showStopNote(squares[to]);
        }
        // 名所を通りすぎるときは、小さなカードを出す
        if (left > 0 && squares[to].type === "place") showPassCard(squares[to]);
      }
      later(step, STEP_MS);
    }
    function step() {
      if (left === 0 || p.home) return later(done, 350);
      if (dir < 0) {
        var back = p.trail[p.trail.length - 1];
        if (back === undefined || back === 0) return later(done, 350);
        p.trail.pop();
        moveTo(back);
        return later(step, STEP_MS);
      }
      var nx = nextOf(p.pos);
      if (nx.length > 1) return chooseBranch(p.pos, left, forward);
      forward(nx[0]);
    }
    step();
  }

  // 分かれ道：どちらに 行くか えらぶ
  function chooseBranch(idx, left, fn) {
    var sq = squares[idx];
    map.showSquares([idx].concat(sq.branch.map(function (b) { return b.to; })));
    Sound.play("reveal");
    openCard({
      type: "fork", title: "どっちに 行く？", text: "のこり " + left + "マス",
      body: '<div class="fork-choices">' + sq.branch.map(function (b, k) {
        return '<button type="button" class="fork-choice" data-k="' + k + '"><b>' + ruby(b.label) + "</b>" +
          (b.note ? "<small>" + ruby(b.note) + "</small>" : "") + "</button>";
      }).join("") + "</div>"
    });
    Array.prototype.forEach.call($("card-body").querySelectorAll(".fork-choice"), function (b) {
      b.addEventListener("click", function () {
        Sound.play("click");
        hideCard();
        fn(sq.branch[Number(b.dataset.k)].to);
      }, { once: true });
    });
  }

  function showPassCard(sq) {
    flashCard(passIcon(sq) + '<div><small>とおりすぎた！</small><b>' + placeName(sq) + "</b></div>");
    Sound.play("pass");
  }

  // かならず止まるマスで止まったとき
  function showStopNote(sq) {
    flashCard(passIcon(sq) + '<div><small>ここで ストップ！</small><b>' + placeName(sq) + "</b></div>");
    Sound.play("reveal");
  }

  // 小さなカードの左の絵：名所の写真があれば写真、なければ星
  function passIcon(sq) {
    var ev = events.places[sq.event];
    return ev && ev.photo ? '<img class="pass-photo" src="' + esc(ev.photo) + '" alt="">' : '<span class="pass-star"></span>';
  }

  function flashCard(html) {
    var el = $("pass-card");
    el.innerHTML = html;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(flashCard.timer);
    flashCard.timer = setTimeout(function () { el.classList.remove("show"); }, PASS_MS);
  }

  // ---------- 止まったマスのイベント ----------

  function addPoints(p, delta) {
    var before = p.points;
    p.points = p.points + delta; // マイナスになってもよい
    return p.points - before;
  }

  // {漢字|かんじ} と書いたところを、ふりがな付きにする
  function ruby(s) {
    return esc(s || "").replace(/\{([^|{}]+)\|([^|{}]+)\}/g, "<ruby>$1<rt>$2</rt></ruby>");
  }

  // 同じものが続けて出ないよう、全部出るまで くじびきのように1つずつ取り出す
  var bags = {};
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  function draw(key, list) {
    if (!list.length) return null;
    if (!bags[key] || !bags[key].length) bags[key] = shuffle(list.slice());
    return bags[key].pop();
  }

  // そのマスで起きてよいイベントだけを選ぶ（where: "coast" / near: 名所）
  function drawFor(type, sqIndex) {
    var ok = events[type].filter(function (ev) { return fitsSquare(ev, sqIndex); });
    if (!ok.length) ok = events[type].filter(function (ev) { return !ev.where && !ev.near; });
    if (!ok.length) return null;
    var bagKey = type + ":" + ok.map(function (ev) { return events[type].indexOf(ev); }).join(",");
    return draw(bagKey, ok);
  }
  function fitsSquare(ev, sqIndex) {
    if (ev.where === "coast" && !coastal[sqIndex]) return false;
    if (ev.near && !nearPlace(sqIndex, ev.near, 3)) return false;
    return true;
  }
  function nearPlace(sqIndex, eventId, within) {
    for (var d = -within; d <= within; d++) {
      var s = squares[(sqIndex + d + squares.length) % squares.length];
      if (s.type === "place" && s.event === eventId) return true;
    }
    return false;
  }

  function arrive() {
    var p = cur();
    map.setInteractive(true);
    map.focus(p.pos);
    // ポイント2ばいカード：この番で止まったマスで 使う
    game.doubleNow = p.double;
    p.double = false;

    if (p.home) return goalEvent(p);
    var sq = squares[p.pos];
    if (sq.type === "place") return placeEvent(sq);
    if (sq.event && events.fixed[sq.event]) return fixedEvent(sq, events.fixed[sq.event]);
    if (sq.type === "quiz") return quizEvent();
    if (sq.type === "move") return moveEvent(drawFor("move", p.pos));
    if (sq.type === "lucky" || sq.type === "happening") return simpleEvent(sq.type, drawFor(sq.type, p.pos));
    if (sq.type === "card") return cardEvent();
    if (sq.type === "rival") return rivalEvent();
    openCard({ type: "unknown", title: "？", text: "このマスの データに もんだいが あります" });
    awardPoints(0);
  }

  // ゴール：着順のボーナス
  function goalEvent(p) {
    p.finishOrder = game.finished++;
    Sound.play("goal");
    openCard({
      type: "goal", badge: "ゴール", title: "ゴール！",
      text: (p.finishOrder + 1) + "着で " + ruby("{両津港|りょうつこう}") + "に もどってきた！ ゴールボーナス"
    });
    awardPoints(GOAL_BONUS[p.finishOrder] || 0, null, true);
  }

  // 名所：写真つきの大きなイベント。dice があればサイコロボーナス
  function placeEvent(sq) {
    var ev = events.places[sq.event] || { title: sq.name, text: "", photo: "", point: 50 };
    openCard({ type: "place", sub: placeName(sq), title: ruby(ev.title), text: ruby(ev.text), photo: ev.photo });
    if (!ev.dice) return awardPoints(ev.point);

    $("card-body").innerHTML = '<div class="bonus-calc">サイコロの 目 × <b>' + ev.dice + "</b>てん</div>";
    cardButton("サイコロを ふる", function () {
      $("card-actions").innerHTML = "";
      rollDice(function (n) {
        var pts = n * ev.dice;
        showBigNumber(n, "× " + ev.dice + "てん！");
        $("card-body").innerHTML = '<div class="bonus-calc"><b>' + n + "</b> × " + ev.dice + " ＝ <b>" + pts + "</b>てん</div>";
        later(function () { awardPoints(pts); }, 700);
      });
    });
  }

  // ラッキー・ハプニング：そのマスで起きてよいものから1つ
  function simpleEvent(type, ev) {
    ev = ev || { title: BADGES[type], text: "", point: 0 };
    openCard({ type: type, title: ruby(ev.title), text: ruby(ev.text) });
    if (ev.bonus) return bonusDice(ev);
    // おまもりカード：ハプニング（マイナス・船よい）を ふせぐ
    if (type === "happening" && (ev.point < 0 || ev.effect) && useGuard(cur())) {
      $("card-body").innerHTML = '<div class="guard-note">おまもりで ふせいだ！</div>';
      return awardPoints(0);
    }
    applyEffect(ev);
    awardPoints(ev.point);
  }

  // 決まったマスのイベント（I♥佐渡・棚田じじい・帰りたくない など）
  function fixedEvent(sq, ev) {
    if (ev.steps) return moveEvent(ev, sq.type);
    openCard({ type: sq.type, badge: "とくべつ", title: ruby(ev.title), text: ruby(ev.text) });
    applyEffect(ev);
    awardPoints(ev.point);
  }

  // もう一度サイコロをふって、決まった目が出たらボーナス（例：流れ星）
  function bonusDice(ev) {
    var b = ev.bonus;
    $("card-body").innerHTML = '<div class="bonus-calc">' + b.dice.join("か") + "が 出たら <b>+" + b.point + "</b>てん！</div>";
    cardButton("サイコロを ふる", function () {
      $("card-actions").innerHTML = "";
      rollDice(function (n) {
        var hit = b.dice.indexOf(n) >= 0;
        showBigNumber(n, hit ? "やった！" : "ざんねん…");
        $("card-body").innerHTML = '<div class="bonus-calc ' + (hit ? "hit" : "miss") + '">' +
          (hit ? ruby(b.title) + " <b>+" + b.point + "</b>てん" : "ざんねん、見られなかった…") + "</div>";
        if (hit) Sound.play("reveal");
        later(function () { awardPoints(ev.point + (hit ? b.point : 0)); }, 700);
      });
    });
  }

  // とくべつな はたらき
  function applyEffect(ev) {
    var p = cur();
    if (ev.effect === "seasick") p.seasick = true;
    if (ev.effect === "tokiUp") p.tokiUp = true;
    if (ev.effect === "twoDice") p.twoDice = true;
  }

  // クイズ：3択。正解でポイント、不正解は解説を出す
  function quizEvent() {
    var q = draw("quiz", quizzes);
    if (!q) {
      openCard({ type: "quiz", title: "クイズマス", text: "クイズが まだ ありません" });
      return awardPoints(0);
    }
    var order = shuffle([0, 1, 2]);
    openCard({
      type: "quiz", title: ruby(q.question),
      body: '<div class="choices">' + order.map(function (k, n) {
        return '<button type="button" class="choice" data-k="' + k + '"><span class="choice-mark">' +
          ["ア", "イ", "ウ"][n] + "</span>" + ruby(q.choices[k]) + "</button>";
      }).join("") + "</div>"
    });
    var buttons = $("card-body").querySelectorAll(".choice");
    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener("click", function () {
        var k = Number(b.dataset.k), ok = k === q.answer;
        Array.prototype.forEach.call(buttons, function (x) {
          x.disabled = true;
          if (Number(x.dataset.k) === q.answer) x.classList.add("correct");
        });
        if (!ok) b.classList.add("wrong");
        var result = document.createElement("div");
        result.className = "quiz-result " + (ok ? "ok" : "ng");
        result.innerHTML = ok ? "せいかい！" :
          "ざんねん… こたえは「" + ruby(q.choices[q.answer]) + "」" + (q.explain ? "<small>" + ruby(q.explain) + "</small>" : "");
        $("card-body").appendChild(result);
        Sound.play(ok ? "reveal" : "minus");
        awardPoints(ok ? q.point : 0);
      }, { once: true });
    });
  }

  // すすむ・もどる：動いた先のマスのイベントは起こさない（ゴールをこえたらゴール）
  function moveEvent(ev, cardType) {
    ev = ev || { title: "すすむ", text: "", steps: 1 };
    var forward = ev.steps > 0;
    openCard({
      type: cardType || "move", badge: cardType ? "とくべつ" : null, title: ruby(ev.title), text: ruby(ev.text),
      body: '<div class="move-steps ' + (forward ? "fwd" : "back") + '">' + Math.abs(ev.steps) + "マス " + (forward ? "すすむ" : "もどる") + "！</div>"
    });
    cardButton(forward ? "すすむ" : "もどる", function () {
      hideCard();
      walk(ev.steps, function () {
        if (cur().home) return arrive();
        map.setInteractive(true);
        later(endTurn, 500);
      });
    });
  }

  // ---------- おとなモード：カード ----------

  // 山札（count の まいすうずつ 入れる）
  function cardDeck() {
    var deck = [];
    events.cards.forEach(function (c) { for (var k = 0; k < c.count; k++) deck.push(c); });
    return deck;
  }

  function cardHtml(c) {
    return '<span class="game-card kind-' + c.kind + '"><b>' + esc(c.title) + "</b><small>" + ruby(c.text) + "</small></span>";
  }

  // おまもりを持っていたら 1まい 使って true
  function useGuard(p) {
    for (var k = 0; k < p.cards.length; k++) {
      if (p.cards[k].kind === "guard") {
        p.cards.splice(k, 1);
        renderScoreboard();
        return true;
      }
    }
    return false;
  }

  // カードマス：1まい 引く。手札が いっぱいなら 交換するか えらぶ
  function cardEvent() {
    var p = cur();
    var c = draw("cards", cardDeck());
    if (!c) {
      openCard({ type: "card", title: "カードが ありません" });
      return nextButton();
    }
    Sound.play("reveal");
    openCard({ type: "card", title: "カードを 引いた！", body: '<div class="drawn">' + cardHtml(c) + "</div>" });
    if (p.cards.length < HAND_MAX) {
      p.cards.push(c);
      renderScoreboard();
      renderHand();
      return nextButton();
    }
    $("card-body").insertAdjacentHTML("beforeend",
      '<p class="hand-full">カードは ' + HAND_MAX + "まいまで。どれと 交換する？</p>" +
      '<div class="swap-choices">' + p.cards.map(function (h, k) {
        return '<button type="button" class="swap-choice" data-k="' + k + '">' + cardHtml(h) + "</button>";
      }).join("") + "</div>");
    Array.prototype.forEach.call($("card-body").querySelectorAll(".swap-choice"), function (b) {
      b.addEventListener("click", function () {
        Sound.play("click");
        p.cards[Number(b.dataset.k)] = c;
        $("card-body").innerHTML = '<div class="drawn">' + cardHtml(c) + '</div><p class="hand-full">交換した！</p>';
        renderScoreboard();
        renderHand();
        nextButton();
      }, { once: true });
    });
    cardButton("交換しない", function () { nextButton(); });
  }

  // 手札（いまの番の人の カード）。サイコロを ふる前に クリックで 使う
  function renderHand() {
    if (!isAdult() || !game) return;
    var p = cur();
    var box = $("hand");
    if (!p.cards.length) {
      box.innerHTML = '<p class="hand-empty">カードマスで 引けるよ</p>';
      return;
    }
    box.innerHTML = "";
    p.cards.forEach(function (c, k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "hand-card kind-" + c.kind;
      b.innerHTML = "<b>" + esc(c.title) + "</b><small>" + (c.kind === "guard" ? "持っているだけで ふせぐ" : ruby(c.text)) + "</small>";
      b.disabled = game.busy || !canUse(p, c);
      b.addEventListener("click", function () { useCard(k); });
      box.appendChild(b);
    });
  }

  function canUse(p, c) {
    if (c.kind === "guard") return false;
    if (p.finishOrder !== null) return c.kind === "steal"; // ゴールした人は よこどりだけ
    if (c.kind === "twoDice") return !p.twoDice;
    if (c.kind === "boost") return !p.boost;
    if (c.kind === "double") return !p.double;
    if (c.kind === "swap") return swapTargets(p).length > 0;
    return true;
  }

  function others(p) { return game.players.filter(function (q) { return q !== p; }); }
  function swapTargets(p) { return others(p).filter(function (q) { return q.finishOrder === null; }); }

  function useCard(k) {
    var p = cur(), c = p.cards[k];
    if (!c || game.busy || !canUse(p, c)) return;
    Sound.play("click");

    // 自分に つかうカードは、すぐ きく
    if (c.kind === "twoDice" || c.kind === "boost" || c.kind === "double") {
      p.cards.splice(k, 1);
      if (c.kind === "twoDice") p.twoDice = true;
      if (c.kind === "boost") p.boost = c.steps;
      if (c.kind === "double") p.double = true;
      flashCard('<span class="pass-star card-star"></span><div><small>カードを 使った！</small><b>' + esc(c.title) + "</b></div>");
      Sound.play("reveal");
      render();
      return;
    }

    // 相手を えらぶカード（いれかえ・よこどり）
    game.busy = true;
    render();
    var back = function () { game.busy = false; render(); };
    openCard({ type: "card", badge: "カード", title: esc(c.title), text: ruby(c.text) });
    pickPlayer(c.kind === "swap" ? swapTargets(p) : others(p), "やめる", function (q) {
      if (!q) { hideCard(); return back(); }
      p.cards.splice(p.cards.indexOf(c), 1);
      renderHand();
      if (useGuard(q)) return blocked(q, back);
      if (c.kind === "swap") return swapPlaces(p, q, function () { nextButton(back); });
      takePoints(q, c.point);
      awardPoints(c.point, back, true);
    });
  }

  // 相手の おまもりで ふせがれた
  function blocked(q, then) {
    $("card-body").innerHTML = '<div class="guard-note">' + esc(q.name) + "さんの おまもりで ふせがれた！</div>";
    Sound.play("minus");
    nextButton(then);
  }

  // 相手を えらぶ。skip を書くと「えらばない」ボタンも出す。fn(えらんだ人 か null)
  function pickPlayer(list, skip, fn) {
    if (!list.length) {
      $("card-body").innerHTML = '<p class="hand-full">えらべる 人が いない…</p>';
      return fn(null);
    }
    $("card-body").innerHTML = '<p class="pick-title">だれに する？</p><div class="pick-choices">' + list.map(function (q, k) {
      return '<button type="button" class="pick-choice" data-k="' + k + '">' + komaIcon(q.koma, 36) +
        "<b>" + esc(q.name) + "</b><small>" + q.points + "てん</small></button>";
    }).join("") + "</div>";
    var done = false;
    Array.prototype.forEach.call($("card-body").querySelectorAll(".pick-choice"), function (b) {
      b.addEventListener("click", function () {
        if (done) return;
        done = true;
        Sound.play("click");
        Array.prototype.forEach.call($("card-body").querySelectorAll(".pick-choice"), function (x) {
          x.disabled = true;
          x.classList.toggle("picked", x === b);
        });
        $("card-actions").innerHTML = "";
        fn(list[Number(b.dataset.k)]);
      });
    });
    if (skip) cardButton(skip, function () { if (!done) { done = true; fn(null); } });
  }

  // 相手の ポイントを へらす（もらう側は awardPoints で ふやす）
  function takePoints(q, amount) {
    q.points -= amount;
    q.shown = q.points;
    renderScoreboard();
  }

  // 2人の いる場所を 入れかえる（動いた先の マスの イベントは 起こさない）
  function swapPlaces(p, q, then) {
    var a = game.players.indexOf(p), b = game.players.indexOf(q);
    var pos = p.pos, trail = p.trail;
    p.pos = q.pos;
    p.trail = q.trail;
    q.pos = pos;
    q.trail = trail;
    map.moveKoma(a, p.pos);
    map.moveKoma(b, q.pos);
    map.showSquares([p.pos, q.pos]);
    Sound.play("pass");
    $("card-body").innerHTML = '<div class="guard-note ok">' + esc(p.name) + "さんと " + esc(q.name) + "さんが 入れかわった！</div>";
    then();
  }

  // ---------- おとなモード：かけひきマス ----------

  function rivalEvent() {
    var p = cur();
    var ev = draw("rival", events.rival);
    if (!ev) {
      openCard({ type: "rival", title: "かけひき" });
      return nextButton();
    }
    openCard({ type: "rival", title: ruby(ev.title), text: ruby(ev.text) });
    if (ev.kind === "swap") {
      return pickPlayer(swapTargets(p), "入れかえない", function (q) {
        if (!q) return nextButton();
        if (useGuard(q)) return blocked(q);
        swapPlaces(p, q, function () { nextButton(); });
      });
    }
    if (ev.kind === "steal") {
      return pickPlayer(others(p), null, function (q) {
        if (!q) return nextButton();
        if (useGuard(q)) return blocked(q);
        takePoints(q, ev.point);
        $("card-body").innerHTML = '<div class="guard-note ok">' + esc(q.name) + "さんから もらった！</div>";
        awardPoints(ev.point, null, true);
      });
    }
    if (ev.kind === "leader") {
      var top = others(p).sort(function (a, b) { return b.points - a.points; })[0];
      if (!top || top.points <= p.points) {
        $("card-body").innerHTML = '<div class="guard-note">あなたが いちばん！ もらえる 人が いない</div>';
        return awardPoints(0, null, true);
      }
      takePoints(top, ev.point);
      $("card-body").innerHTML = '<div class="guard-note ok">' + esc(top.name) + "さんから もらった！</div>";
      return awardPoints(ev.point, null, true);
    }
    if (ev.kind === "share") {
      var list = others(p);
      list.forEach(function (q) { q.points += ev.point; q.shown = q.points; });
      $("card-body").innerHTML = '<div class="guard-note">' + list.map(function (q) { return esc(q.name) + "さん +" + ev.point; }).join("　") + "</div>";
      renderScoreboard();
      return awardPoints(-ev.point * list.length, null, true);
    }
    if (ev.kind === "duel") {
      return pickPlayer(others(p), null, function (q) {
        if (!q) return nextButton();
        duel(p, q, ev.point);
      });
    }
    nextButton();
  }

  // サイコロ勝負：1回ずつ ふって、大きい目の人が 相手から もらう
  function duel(p, q, pts) {
    function side(x, v, id) {
      return '<div class="duel-side">' + komaIcon(x.koma, 40) + "<b>" + esc(x.name) + '</b><span id="' + id + '">' + v + "</span></div>";
    }
    $("card-body").innerHTML = '<div class="duel">' + side(p, "?", "duel-a") + '<span class="duel-vs">VS</span>' + side(q, "?", "duel-b") + "</div>";
    cardButton(esc(p.name) + "さんが ふる", function () {
      $("card-actions").innerHTML = "";
      rollDice(function (a) {
        $("duel-a").textContent = a;
        showBigNumber(a, esc(p.name) + "さん");
        cardButton(esc(q.name) + "さんが ふる", function () {
          $("card-actions").innerHTML = "";
          rollDice(function (b) {
            $("duel-b").textContent = b;
            showBigNumber(b, esc(q.name) + "さん");
            var result = document.createElement("div");
            result.className = "quiz-result " + (a > b ? "ok" : "ng");
            result.textContent = a === b ? "ひきわけ！" : (a > b ? p.name : q.name) + "さんの 勝ち！";
            $("card-body").appendChild(result);
            if (a === b) return nextButton();
            if (a > b) {
              takePoints(q, pts);
              return awardPoints(pts, null, true);
            }
            q.points += pts;
            q.shown = q.points;
            renderScoreboard();
            awardPoints(-pts, null, true);
          });
        });
      });
    });
  }

  // ---------- 野生のトキ（どのマスでも、イベントのあとに ときどき出る） ----------

  function endTurn() {
    var p = cur();
    game.doubleNow = false; // 2ばいは 止まったマスの イベントだけ（野生のトキには きかない）
    var t = events.wildToki;
    var chance = t ? (p.tokiUp ? Math.max(0.1, t.chance * 2) : t.chance) : 0;
    if (p.tokiCount >= TOKI_MAX) chance = 0;
    if (t && Math.random() < chance) {
      p.tokiCount++;
      Sound.play("fanfare");
      openCard({ type: "toki", badge: "レア！", title: ruby(t.title), text: ruby(t.text), photo: t.photo });
      return awardPoints(t.point, nextTurn);
    }
    nextTurn();
  }
  // ---------- イベントカード ----------

  function openCard(o) {
    var card = $("event-card");
    card.className = "event-card type-" + o.type + (o.photo ? " has-photo" : "");
    card.innerHTML =
      (o.photo ? '<div class="card-photo"><img src="' + esc(o.photo) + '" alt=""></div>' : "") +
      '<span class="card-badge">' + esc(o.badge || BADGES[o.type] || "") + "</span>" +
      (o.sub ? '<div class="card-sub">' + o.sub + "</div>" : "") +
      "<h3>" + o.title + "</h3>" +
      (o.text ? "<p>" + o.text + "</p>" : "") +
      '<div id="card-body" class="card-body">' + (o.body || "") + "</div>" +
      '<div id="card-points" class="card-points" hidden></div>' +
      '<div id="card-actions" class="card-actions"></div>';
    // 写真がまだ無いときは「じゅんびちゅう」と出す
    var img = card.querySelector(".card-photo img");
    if (img) img.addEventListener("error", function () { img.parentNode.classList.add("missing"); img.remove(); });
    // 次のフレームで show を付けて、下から出てくるようにする
    requestAnimationFrame(function () { card.classList.add("show"); });
  }

  function cardButton(label, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "big-button";
    b.innerHTML = label;
    b.addEventListener("click", function () { Sound.play("click"); fn(b); }, { once: true });
    $("card-actions").appendChild(b);
    return b;
  }

  // ポイントを出す：カウントアップ → スコアボードへ飛ばす → スコアボードもカウントアップ。「つぎへ」も出す
  // then：「つぎへ」を押したあとに することは（ふつうは endTurn：野生のトキ → 次の人）
  // plain：ポイント2ばいカードを 使わない（ゴールボーナスや カード・かけひきの やりとり）
  function awardPoints(raw, then, plain) {
    var player = game.turn;
    var doubled = false;
    if (game.doubleNow && raw > 0 && !plain) {
      raw *= 2;
      doubled = true;
      game.doubleNow = false;
    }
    var delta = addPoints(cur(), raw);
    var sign = delta > 0 ? "plus" : delta < 0 ? "minus" : "zero";
    var box = $("card-points");
    box.hidden = false;
    box.className = "card-points " + sign;
    box.innerHTML = '<span id="card-num">' + fmt(0, delta) + "</span><small>てん</small>" + (doubled ? '<em class="x2">2ばい！</em>' : "");
    nextButton(then);

    later(function () {
      countUp($("card-num"), 0, delta, 600, function (v) { return fmt(v, delta); }, function () {
        Sound.play(sign);
        if (delta === 0) return;
        later(function () { flyPoints(player, delta); }, 350);
      });
    }, 400);
  }

  // 「つぎへ」ボタン。then：押したあとに することは（ふつうは endTurn：野生のトキ → 次の人）
  function nextButton(then) {
    $("card-actions").innerHTML = "";
    cardButton("つぎへ", function () {
      finishScoreAnimations();
      hideCard();
      (then || endTurn)();
    }).id = "card-next";
    // 画面が低いときも、こたえ・ポイント・「つぎへ」が 見えるように 下まで スクロール
    var card = $("event-card");
    requestAnimationFrame(function () { card.scrollTop = card.scrollHeight; });
  }
  function fmt(v, delta) {
    if (delta > 0) return "+" + v;
    if (delta < 0) return "−" + Math.abs(v);
    return "±0";
  }

  // el の数字を from から to まで、ms ミリ秒かけて変える
  function countUp(el, from, to, ms, format, done) {
    var start = performance.now();
    var lastTick = 0;
    (function frame(now) {
      if (!el.isConnected) return; // 画面が書きかわったら止める
      var t = Math.min(1, (now - start) / ms);
      var v = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 2)));
      el.textContent = format(v);
      if (now - lastTick > 70 && t < 1 && from !== to) { Sound.play("tick"); lastTick = now; }
      if (t < 1) requestAnimationFrame(frame);
      else if (done) done();
    })(start);
  }

  // カードのポイントがスコアボードへ飛んでいく
  function flyPoints(i, delta) {
    var from = $("card-num"), to = $("sb-points-" + i);
    if (!from || !to) return finishScoreAnimations();
    var a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    var fly = document.createElement("div");
    fly.className = "fly-points " + (delta > 0 ? "plus" : "minus");
    fly.textContent = fmt(delta, delta);
    fly.style.left = a.left + "px";
    fly.style.top = a.top + "px";
    document.body.appendChild(fly);
    requestAnimationFrame(function () {
      fly.style.transform = "translate(" + (b.left - a.left) + "px," + (b.top - a.top) + "px) scale(0.6)";
      fly.style.opacity = "0.4";
    });
    later(function () {
      fly.remove();
      var p = game.players[i];
      var el = $("sb-points-" + i);
      if (!el) return;
      Sound.play("coin");
      el.parentNode.classList.add("bump");
      var fromV = p.shown;
      p.shown = p.points;
      countUp(el.firstChild, fromV, p.points, 500, String, function () { renderScoreboard(); });
    }, 650);
  }

  // 演出の途中で「つぎへ」が押されたら、ポイントの表示を最後の数字にそろえる
  function finishScoreAnimations() {
    clearTimers();
    Array.prototype.forEach.call(document.querySelectorAll(".fly-points"), function (el) { el.remove(); });
    game.players.forEach(function (p) { p.shown = p.points; });
    renderScoreboard();
  }

  function hideCard() {
    $("event-card").classList.remove("show");
  }

  function nextTurn() {
    game.busy = false;
    game.doubleNow = false;
    $("dice-result").textContent = "";
    if (game.finished >= game.players.length) {
      later(showResults, 600);
      return;
    }
    // ゴールした人にも番が回ってくる（出た目 × 10てん）
    game.turn = (game.turn + 1) % game.players.length;
    render();
  }

  // ゴールした人が、ほかの人を まっている あいだの ボーナス
  function waitingBonus(n) {
    var pts = n === 1 ? WAITING_ONE : n * WAITING_BONUS;
    map.setInteractive(true);
    openCard({
      type: "goal", badge: "ゴールずみ", title: "まちじかん ボーナス",
      text: ruby("{両津港|りょうつこう}で みんなを まちながら、サイコロを ふったよ。"),
      body: n === 1
        ? '<div class="bonus-calc miss"><b>1</b> が 出ちゃった… <b>−10</b>てん</div>'
        : '<div class="bonus-calc"><b>' + n + "</b> × " + WAITING_BONUS + " ＝ <b>" + pts + "</b>てん</div>"
    });
    awardPoints(pts, nextTurn);
  }

  // ---------- 結果発表 ----------

  function showResults() {
    Sound.stopBgm();
    // ポイントの多い順。同点なら先にゴールした人が上
    var ranked = game.players.slice().sort(function (a, b) {
      return b.points - a.points || a.finishOrder - b.finishOrder;
    });

    var slot = function (p, rank) {
      return '<div class="podium-slot rank-' + rank + '" id="podium-' + rank + '">' +
        '<div class="podium-koma">' + komaIcon(p.koma, 76) + "</div>" +
        '<div class="podium-name">' + esc(p.name) + "</div>" +
        '<div class="podium-points">' + p.points + "<small>てん</small></div>" +
        '<div class="podium-block" style="background:' + p.koma.color + '">' + rank + "<small>い</small></div></div>";
    };

    // 表彰台は 2位・1位・3位 の順にならべる
    $("podium").innerHTML = [1, 0, 2].filter(function (r) { return ranked[r]; })
      .map(function (r) { return slot(ranked[r], r + 1); }).join("");
    $("other-ranks").innerHTML = ranked.slice(3).map(function (p, i) {
      return "<li>" + (i + 4) + "い " + komaIcon(p.koma, 32) + esc(p.name) + "　" + p.points + "てん</li>";
    }).join("");
    $("again-button").classList.remove("show");

    showScreen("result-screen");

    // 3位 → 2位 → 1位 の順に登場。1位で紙吹雪
    var order = [3, 2, 1].filter(function (r) { return ranked[r - 1]; });
    Sound.play("drum");
    order.forEach(function (rank, k) {
      later(function () {
        $("podium-" + rank).classList.add("show");
        if (rank === 1) {
          Sound.play("fanfare");
          Confetti.start($("confetti"));
          later(function () { $("again-button").classList.add("show"); }, 1200);
        } else {
          Sound.play("podium");
        }
      }, 900 + k * 1100 + (rank === 1 ? 400 : 0));
    });
  }

  // ---------- 紙吹雪 ----------

  var Confetti = (function () {
    var COLORS = ["#d4a017", "#2c7fb8", "#3f9a4a", "#e8708e", "#f2c230", "#8e5cc4", "#ffffff"];
    var running = null;
    function start(canvas) {
      stop();
      var c = canvas.getContext("2d");
      var w = canvas.width = canvas.clientWidth, h = canvas.height = canvas.clientHeight;
      var pieces = [];
      for (var i = 0; i < 180; i++) {
        pieces.push({
          x: Math.random() * w, y: -20 - Math.random() * h * 0.6,
          vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
          r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
          s: 6 + Math.random() * 8, color: COLORS[i % COLORS.length]
        });
      }
      var end = performance.now() + 6000;
      (function frame(now) {
        c.clearRect(0, 0, w, h);
        pieces.forEach(function (p) {
          p.x += p.vx + Math.sin((now / 400) + p.r) * 0.6;
          p.y += p.vy;
          p.r += p.vr;
          if (p.y > h + 20 && now < end - 1500) { p.y = -20; p.x = Math.random() * w; }
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.r);
          c.fillStyle = p.color;
          c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
          c.restore();
        });
        if (now < end) running = requestAnimationFrame(frame);
        else c.clearRect(0, 0, w, h);
      })(performance.now());
    }
    function stop() { if (running) cancelAnimationFrame(running); running = null; }
    return { start: start, stop: stop };
  })();

  // ---------- はじめる ----------

  // こども・おとな 両方の データの問題（同じ お知らせは 1回だけ）
  showProblems(MODES.kids.problems.concat(MODES.adult.problems).filter(function (m, k, all) { return all.indexOf(m) === k; }));
  // タイトル画面と結果発表のかざり
  ["title-screen", "result-screen"].forEach(function (id) {
    $(id).insertAdjacentHTML("afterbegin", sadoSilhouette("bg-sado"));
  });
  $("title-komas").innerHTML = KOMA.map(function (k) { return komaIcon(k, 46); }).join("");
  buildDice();
  spinDiceTo(1);
  renderSetup();
  renderSoundButton();
  $("sound-button").addEventListener("click", function () {
    Sound.unlock();
    Sound.setOn(!Sound.isOn());
    renderSoundButton();
    if (Sound.isOn() && game && $("game-screen").classList.contains("active")) Sound.startBgm();
  });
  $("start-button").addEventListener("click", startGame);
  $("roll-button").addEventListener("click", roll);
  $("again-button").addEventListener("click", function () {
    Sound.play("click");
    clearTimers();
    Confetti.stop();
    if (map) { map.destroy(); map = null; }
    showScreen("title-screen");
  });

  // ---------- 編集モード（URLの最後に ?edit=1） ----------
  // 地図をクリックすると緯度・経度が出る。マスをドラッグすると、data/squares.js に書く行が出る。

  function startEdit() {
    document.body.classList.add("edit-mode");
    showScreen("game-screen");
    $("turn-banner").style.background = "var(--sea-deep)";
    $("turn-text").innerHTML = "<span>へんしゅうモード</span>";
    map = MapView.create($("map"), $("minimap"), $("map-offline"), squares, [], {
      edit: true,
      onMapClick: function (lat, lng) {
        $("edit-click").value = "lat: " + lat + ", lng: " + lng;
      },
      onSquareClick: function (i) { showSquareLine(i); },
      onSquareMoved: function (i) { showSquareLine(i); }
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (b) {
      b.addEventListener("click", function () { copyText($(b.dataset.copy)); });
    });
  }

  // data/squares.js に書く1行（もとの書き方に、新しい lat・lng を入れる）
  function squareLine(i) {
    var raw = (MODES[mode].rawSquares && MODES[mode].rawSquares[i]) || {};
    var sq = squares[i];
    var keys = ["id", "type", "name", "yomi", "lat", "lng", "event"];
    Object.keys(raw).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    var parts = [];
    keys.forEach(function (k) {
      var v = k === "lat" ? sq.lat : k === "lng" ? sq.lng : raw[k];
      if (v === undefined) return;
      parts.push(k + ": " + (typeof v === "object" ? JSON.stringify(v) : typeof v === "string" ? '"' + v + '"' : v));
    });
    return "{ " + parts.join(", ") + " },";
  }

  function showSquareLine(i) {
    $("edit-square-title").textContent = "マス" + i + "（" + (squares[i].name || squares[i].type) + "）";
    $("edit-line").value = squareLine(i);
  }

  function copyText(el) {
    var text = el.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { el.select(); document.execCommand("copy"); });
    } else {
      el.select();
      document.execCommand("copy");
    }
  }

  // おとなモードのマスは ?edit=1&mode=adult
  if (/[?&]edit=1/.test(location.search)) {
    if (/[?&]mode=adult/.test(location.search)) setMode("adult");
    if (squares) startEdit();
  }
})();
