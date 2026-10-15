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
  var BADGES = { place: "めいしょ", lucky: "ラッキー", quiz: "クイズ", happening: "ハプニング", move: "すすむ・もどる", toki: "レア！", unknown: "？" };

  var GOAL_BONUS = [100, 60, 30, 10];
  var STEP_MS = 300;   // 1マス進む時間
  var DICE_MS = 1700;  // サイコロが転がっている時間
  var PASS_MS = 2000;  // 名所を通りすぎたときのカードを出しておく時間
  var PIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  // サイコロの目 n を正面に向けるための回転（X, Y）
  var DICE_FACE = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function placeName(sq) {
    return sq.yomi ? "<ruby>" + esc(sq.name) + "<rt>" + esc(sq.yomi) + "</rt></ruby>" : esc(sq.name);
  }

  var checked = checkSquares(window.SQUARES);
  var squares = checked.squares;
  var checkedEvents = checkEvents(window.EVENTS, squares);
  var events = checkedEvents.events;
  var checkedQuizzes = checkQuizzes(window.QUIZZES);
  var quizzes = checkedQuizzes.quizzes;
  // 海岸に近いマス（海岸線から 約1km 以内）
  var COAST_KM = 1.0;
  var coastal = (squares || []).map(function (s) { return Roads.coastDistanceKm(s.lat, s.lng) <= COAST_KM; });
  var setup = { count: 2, players: [0, 1, 2, 3].map(function (i) { return { name: "", koma: i }; }) };
  var game = null;
  var map = null;
  var dice = { x: 0, y: 0 };

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

    $("start-button").disabled = !squares;
  }

  // ---------- ゲーム ----------

  function startGame() {
    if (!squares) return;
    Sound.unlock();
    Sound.play("click");
    clearTimers();
    game = { players: [], turn: 0, finished: 0, busy: false };
    setup.players.slice(0, setup.count).forEach(function (p, i) {
      game.players.push({
        name: p.name.trim() || "プレイヤー" + (i + 1),
        koma: KOMA[p.koma],
        pos: 0,           // 進んだマスの数（squares.length でゴール）
        points: 0,
        shown: 0,         // スコアボードに出しているポイント（カウントアップのため）
        finishOrder: null, // ゴールした順番（0 = 1着）
        seasick: false,   // 船よい：つぎの番で すすむマスが 1 へる
        tokiUp: false     // I♥佐渡：野生のトキに 会える かくりつが 上がる
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
    $("turn-text").innerHTML = komaIcon(p.koma, 52) + "<span>" + esc(p.name) + "さんの 番</span>";
    banner.classList.remove("turn-pop");
    void banner.offsetWidth;
    banner.classList.add("turn-pop");
    renderScoreboard();
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
        '<span class="sb-rank">' + currentRank(p) + "ばん</span></li>";
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
  }

  // 目 n が正面に来るように、何回転かしてから止める
  function spinDiceTo(n) {
    var f = DICE_FACE[n];
    dice.x = Math.ceil((dice.x + 720) / 360) * 360 + f[0];
    dice.y = Math.ceil((dice.y + 1080) / 360) * 360 + f[1];
    $("dice").style.transform = "rotateX(" + dice.x + "deg) rotateY(" + dice.y + "deg)";
  }

  // サイコロを転がして、止まった目を done(n) にわたす
  function rollDice(done) {
    var n = 1 + Math.floor(Math.random() * 6);
    var scene = $("dice-scene");
    scene.classList.remove("landed");
    scene.classList.add("rolling");
    Sound.play("dice");
    spinDiceTo(n);
    later(function () {
      scene.classList.remove("rolling");
      scene.classList.add("landed");
      Sound.play("diceStop");
      done(n);
    }, DICE_MS);
  }

  // pos から先、n マスぶんのマスの番号（ゴールと「かならず止まる」マスで切る）。カメラ合わせに使う
  function aheadOf(pos, n) {
    var list = [pos % squares.length];
    for (var k = 1; k <= n; k++) {
      var q = pos + k;
      if (q >= squares.length) { list.push(0); break; }
      list.push(q);
      if (squares[q].stop) break;
    }
    return list;
  }

  // n マス進むと、どこまで行けるか（かならず止まるマスとゴールで止まる）
  function stepsUntilStop(pos, n) {
    for (var k = 1; k <= n; k++) {
      if (pos + k >= squares.length || squares[pos + k].stop) return k;
    }
    return n;
  }

  function roll() {
    if (!game || game.busy) return;
    game.busy = true;
    $("roll-button").disabled = true;
    // サイコロをふったら地図は動かせなくする
    map.setInteractive(false);
    $("dice-result").textContent = "";

    rollDice(function (n) {
      var p = cur();
      var steps = n;
      var label = "マス すすむ！";
      // 船よい：1 へる（1が出たときは 1マス）
      if (p.seasick) {
        p.seasick = false;
        steps = Math.max(1, n - 1);
        label = "− 1 ＝ " + steps + "マス（ふなよい）";
        renderScoreboard();
      }
      var go = stepsUntilStop(p.pos, steps);
      $("dice-result").innerHTML = "<b>" + n + "</b> " + (steps !== n ? "→ " + steps + "マス" : "マス すすむ！");
      showBigNumber(n, label);
      // これから通るマスが ぜんぶ見えるように カメラを合わせる
      map.showSquares(aheadOf(p.pos, go));
      later(function () { walk(go, arrive, go < steps); }, 900);
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
  // 進むときは、ゴールと「かならず止まる」マスで止まる。もどるときはスタートの次のマスまで
  // cut：出た目より手前で止めたとき true（「ここで ストップ！」を出す）
  function walk(steps, done, cut) {
    var p = cur();
    var i = game.turn;
    var dir = steps > 0 ? 1 : -1;
    var left = Math.abs(steps);
    var hop = 0;
    map.setInteractive(false);
    (function step() {
      if (left === 0 || p.pos >= squares.length || p.pos + dir < 1) {
        later(done, 350);
        return;
      }
      p.pos += dir;
      left--;
      var idx = p.pos % squares.length;
      map.moveKoma(i, idx);
      map.follow(idx);
      Sound.play("hop", dir > 0 ? hop++ : -(hop++));
      if (dir > 0 && squares[idx].stop && (left > 0 || (cut && left === 0))) {
        left = 0;
        showStopNote(squares[idx]);
      }
      // 名所を通りすぎるときは、小さなカードを出す
      var passing = left > 0 && p.pos < squares.length;
      if (passing && squares[idx].type === "place") showPassCard(squares[idx]);
      later(step, STEP_MS);
    })();
  }

  function showPassCard(sq) {
    flashCard('<span class="pass-star"></span><div><small>とおりすぎた！</small><b>' + placeName(sq) + "</b></div>");
    Sound.play("pass");
  }

  // かならず止まるマスで止まったとき
  function showStopNote(sq) {
    flashCard('<span class="pass-star"></span><div><small>ここで ストップ！</small><b>' + placeName(sq) + "</b></div>");
    Sound.play("reveal");
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
    p.points = Math.max(0, p.points + delta);
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
    map.focus(p.pos % squares.length);

    if (p.pos >= squares.length) return goalEvent(p);
    var sq = squares[p.pos];
    if (sq.type === "place") return placeEvent(sq);
    if (sq.event && events.fixed[sq.event]) return fixedEvent(sq, events.fixed[sq.event]);
    if (sq.type === "quiz") return quizEvent();
    if (sq.type === "move") return moveEvent(drawFor("move", p.pos));
    if (sq.type === "lucky" || sq.type === "happening") return simpleEvent(sq.type, drawFor(sq.type, p.pos));
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
    awardPoints(GOAL_BONUS[p.finishOrder] || 0);
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
      var p = cur();
      var n = forward ? stepsUntilStop(p.pos, ev.steps) : ev.steps;
      walk(n, function () {
        if (cur().pos >= squares.length) return arrive();
        map.setInteractive(true);
        later(endTurn, 500);
      }, forward && n < ev.steps);
    });
  }

  // ---------- 野生のトキ（どのマスでも、イベントのあとに ときどき出る） ----------

  function endTurn() {
    var p = cur();
    var t = events.wildToki;
    var chance = t ? (p.tokiUp ? Math.max(0.1, t.chance * 2) : t.chance) : 0;
    if (t && Math.random() < chance) {
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
  function awardPoints(raw, then) {
    var player = game.turn;
    var delta = addPoints(cur(), raw);
    var sign = delta > 0 ? "plus" : delta < 0 ? "minus" : "zero";
    var box = $("card-points");
    box.hidden = false;
    box.className = "card-points " + sign;
    box.innerHTML = '<span id="card-num">' + fmt(0, delta) + "</span><small>てん</small>";
    $("card-actions").innerHTML = "";
    cardButton("つぎへ", function () {
      finishScoreAnimations();
      hideCard();
      (then || endTurn)();
    }).id = "card-next";

    later(function () {
      countUp($("card-num"), 0, delta, 600, function (v) { return fmt(v, delta); }, function () {
        Sound.play(sign);
        if (delta === 0) return;
        later(function () { flyPoints(player, delta); }, 350);
      });
    }, 400);
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
    $("dice-result").textContent = "";
    if (game.finished >= game.players.length) {
      later(showResults, 600);
      return;
    }
    // ゴールした人の番はとばす
    do {
      game.turn = (game.turn + 1) % game.players.length;
    } while (cur().finishOrder !== null);
    render();
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

  showProblems(checked.problems.concat(checkedEvents.problems, checkedQuizzes.problems));
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
    var raw = (window.SQUARES && window.SQUARES[i]) || {};
    var sq = squares[i];
    var keys = ["id", "type", "name", "yomi", "lat", "lng", "event"];
    Object.keys(raw).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    var parts = [];
    keys.forEach(function (k) {
      var v = k === "lat" ? sq.lat : k === "lng" ? sq.lng : raw[k];
      if (v === undefined) return;
      parts.push(k + ": " + (typeof v === "string" ? '"' + v + '"' : v));
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

  if (/[?&]edit=1/.test(location.search) && squares) startEdit();
})();
