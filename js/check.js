// =====================================================
// データのチェック
// 書き間違いがあってもゲームは止めず、問題をリストにして返す。
// =====================================================

var SQUARE_TYPES = ["start", "place", "lucky", "quiz", "happening", "move", "card", "rival", "shop"];

// file：お知らせに出すファイル名、label：「ハードモードの」など、お知らせの頭につける言葉
function checkSquares(raw, file, label) {
  var problems = [];
  file = file || "data/squares.js";
  label = label || "";

  if (!Array.isArray(raw) || raw.length < 2) {
    problems.push(file + " が読みこめません。カッコや「,」の書き間違いがないか確認してください。");
    return { squares: null, problems: problems };
  }

  function bad(i, msg) {
    problems.push(label + "マス" + i + "のデータに問題あり：" + msg);
  }

  var squares = raw.map(function (s, i) {
    var sq = { id: i, type: "unknown", name: "", yomi: "", lat: NaN, lng: NaN, event: null };

    if (!s || typeof s !== "object") {
      bad(i, "書き方がちがいます");
      return sq;
    }
    if (s.id !== i) bad(i, "id が " + s.id + " になっています（" + i + " にしてください）");

    if (SQUARE_TYPES.indexOf(s.type) >= 0) sq.type = s.type;
    else bad(i, "type \"" + s.type + "\" という種類はありません");

    // 佐渡のまわり（緯度 37.6〜38.5、経度 138.0〜138.8）に入っているか
    if (isNum(s.lat) && isNum(s.lng) && s.lat > 37.6 && s.lat < 38.5 && s.lng > 138.0 && s.lng < 138.8) {
      sq.lat = s.lat;
      sq.lng = s.lng;
    } else {
      bad(i, "lat と lng（緯度・経度）が佐渡の場所になっていません");
    }

    if (typeof s.name === "string") sq.name = s.name;
    if (typeof s.yomi === "string") sq.yomi = s.yomi;
    if ((sq.type === "place" || sq.type === "start") && !sq.name) {
      bad(i, "name（名前）がありません");
      sq.name = "（名前なし）";
    }
    sq.event = s.event || null;
    sq.stop = s.stop === true;
    return sq;
  });

  // つぎのマス（next）と分かれ道（branch）。ゴールは 0（両津港にもどる）
  var n = raw.length;
  function okId(v) { return typeof v === "number" && v % 1 === 0 && v >= 0 && v < n; }
  squares.forEach(function (sq, i) {
    var s = raw[i] || {};
    if (s.next !== undefined) {
      if (okId(s.next)) sq.next = s.next;
      else bad(i, "next は 0〜" + (n - 1) + " のマスの id にしてください");
    }
    if (s.branch !== undefined) {
      var ok = Array.isArray(s.branch) && s.branch.length >= 2 && s.branch.every(function (b) { return b && okId(b.to); });
      if (!ok) bad(i, "branch は [{ to: マスの id, label: \"道の名前\" }, { … }] のように 2つ以上 書いてください");
      else sq.branch = s.branch.map(function (b) {
        return { to: b.to, label: typeof b.label === "string" ? b.label : "マス" + b.to + "へ", note: typeof b.note === "string" ? b.note : "" };
      });
    }
  });

  if (squares[0].type !== "start") {
    bad(0, "最初のマスは type: \"start\"（両津港）にしてください");
  }

  // 場所が書かれていないマスは、となりのマスの間に置く
  squares.forEach(function (sq, i) {
    if (isNum(sq.lat)) return;
    var a = nearestValid(squares, i, -1);
    var b = nearestValid(squares, i, 1);
    sq.lat = (a.lat + b.lat) / 2;
    sq.lng = (a.lng + b.lng) / 2;
  });

  return { squares: squares, problems: problems };
}

function isNum(v) {
  return typeof v === "number" && isFinite(v);
}

function nearestValid(squares, i, dir) {
  var n = squares.length;
  for (var k = 1; k < n; k++) {
    var s = squares[(i + dir * k + n) % n];
    if (isNum(s.lat) && isNum(s.lng)) return s;
  }
  return { lat: 38.08, lng: 138.44 };
}

// ---------- イベント（data/events.js） ----------

// ポイントの幅（SPECの「イベントの型とポイント目安」）
var RANGES = {
  place: [20, 100], dice: [10, 30], lucky: [10, 30], happening: [-20, -10], move: [-3, 3], quiz: [10, 30],
  fixed: [-50, 100], toki: [50, 200], bonus: [10, 100],
  // ハードモード
  steal: [10, 50], duel: [10, 50], leader: [10, 30], share: [10, 30], boost: [1, 3], count: [1, 5],
  price: [10, 100], max: [1, 5]
};
var EFFECTS = ["seasick", "tokiUp", "twoDice", "card"];
var CARD_KINDS = ["twoDice", "boost", "double", "swap", "steal", "guard"];
var RIVAL_KINDS = ["swap", "steal", "leader", "share", "duel"];

function clampTo(v, range) { return Math.max(range[0], Math.min(range[1], v)); }

function checkEvents(raw, squares, label) {
  var problems = [];
  label = label || "";
  var out = { places: {}, lucky: [], happening: [], move: [], fixed: {}, wildToki: null, cards: [], rival: [], shop: null };
  if (!raw || typeof raw !== "object") {
    problems.push("data/events.js が読みこめません。カッコや「,」の書き間違いがないか確認してください。");
    return { events: out, problems: problems };
  }
  function bad(where, msg) { problems.push(where + "のデータに問題あり：" + msg); }
  function text(e, key) { return typeof e[key] === "string" ? e[key] : ""; }
  // point を調べて、幅の中に直す
  function point(where, e, range, label) {
    var p = e.point;
    if (!isNum(p)) { bad(where, "point が数字になっていません"); return range[0] < 0 ? range[1] : range[0]; }
    var v = clampTo(p, range);
    if (v !== p) bad(where, (label || "point") + " は " + range[0] + "〜" + range[1] + " にしてください（" + v + " にしました）");
    return v;
  }
  function steps(where, e) {
    if (!isNum(e.steps) || e.steps === 0) { bad(where, "steps は 1〜3（もどるときは -1〜-3）にしてください"); return 1; }
    var v = clampTo(Math.round(e.steps), RANGES.move);
    if (v !== e.steps) bad(where, "steps は 1〜3（もどるときは -1〜-3）にしてください（" + v + " にしました）");
    return v;
  }
  function effect(where, e) {
    if (e.effect === undefined) return null;
    if (EFFECTS.indexOf(e.effect) < 0) { bad(where, "effect \"" + e.effect + "\" という はたらきは ありません"); return null; }
    return e.effect;
  }

  (Array.isArray(raw.places) ? raw.places : []).forEach(function (e, i) {
    var where = "名所イベント" + (e && e.id ? "「" + e.id + "」" : (i + 1) + "番目");
    if (!e || typeof e !== "object" || !e.id) return bad(where, "id がありません");
    var ev = { id: e.id, title: text(e, "title") || "（タイトルなし）", text: text(e, "text"), photo: text(e, "photo") };
    if (e.dice !== undefined) {
      if (!isNum(e.dice)) { bad(where, "dice が数字になっていません"); ev.dice = 10; }
      else {
        ev.dice = clampTo(e.dice, RANGES.dice);
        if (ev.dice !== e.dice) bad(where, "dice は 10〜30 にしてください（" + ev.dice + " にしました）");
      }
    } else {
      ev.point = point(where, e, RANGES.place);
    }
    out.places[e.id] = ev;
  });

  var placeIds = Object.keys(out.places);
  [["lucky", "ラッキー"], ["happening", "ハプニング"]].forEach(function (kind) {
    var key = kind[0];
    (Array.isArray(raw[key]) ? raw[key] : []).forEach(function (e, i) {
      var where = kind[1] + "イベント" + (i + 1) + "番目";
      if (!e || typeof e !== "object") return bad(where, "書き方がちがいます");
      var ev = { title: text(e, "title") || kind[1], text: text(e, "text"), effect: effect(where, e) };
      // effect だけのハプニング（船よい など）は point 0 でもよい
      if (key === "happening" && ev.effect && (e.point === 0 || e.point === undefined)) ev.point = 0;
      else {
        if (key === "happening" && isNum(e.point) && e.point > 0) {
          bad(where, "ハプニングの point はマイナスにしてください（-" + e.point + " にしました）");
          e = Object.assign({}, e, { point: -e.point });
        }
        ev.point = point(where, e, RANGES[key]);
      }
      if (e.where !== undefined) {
        if (e.where === "coast") ev.where = "coast";
        else bad(where, "where は \"coast\" だけ 書けます");
      }
      if (e.near !== undefined) {
        if (placeIds.indexOf(e.near) >= 0) ev.near = e.near;
        else bad(where, "near \"" + e.near + "\" という 名所の id は ありません");
      }
      if (e.bonus) {
        var b = e.bonus;
        if (!Array.isArray(b.dice) || !b.dice.length) bad(where, "bonus の dice は [1, 6] のように 書いてください");
        else ev.bonus = { dice: b.dice, title: text(b, "title") || "やったね！", point: point(where, b, RANGES.bonus, "bonus の point") };
      }
      out[key].push(ev);
    });
  });

  (Array.isArray(raw.move) ? raw.move : []).forEach(function (e, i) {
    var where = "すすむ・もどるイベント" + (i + 1) + "番目";
    if (!e || typeof e !== "object") return bad(where, "書き方がちがいます");
    var v = steps(where, e);
    out.move.push({ title: text(e, "title") || (v > 0 ? "すすむ" : "もどる"), text: text(e, "text"), steps: v });
  });

  (Array.isArray(raw.fixed) ? raw.fixed : []).forEach(function (e, i) {
    var where = "決まったマスのイベント" + (e && e.id ? "「" + e.id + "」" : (i + 1) + "番目");
    if (!e || typeof e !== "object" || !e.id) return bad(where, "id がありません");
    var ev = { id: e.id, title: text(e, "title") || "（タイトルなし）", text: text(e, "text"), effect: effect(where, e) };
    if (e.steps !== undefined) ev.steps = steps(where, e);
    else ev.point = point(where, e, RANGES.fixed);
    out.fixed[e.id] = ev;
  });

  if (raw.wildToki) {
    var t = raw.wildToki, where = "野生のトキ";
    var chance = isNum(t.chance) ? Math.max(0, Math.min(0.5, t.chance)) : 0.05;
    if (isNum(t.chance) && chance !== t.chance) bad(where, "chance は 0〜0.5 にしてください");
    out.wildToki = { title: text(t, "title") || "野生の トキを 見つけた！", text: text(t, "text"), photo: text(t, "photo"),
      point: point(where, t, RANGES.toki), chance: chance };
  }

  // ハードモードのカード
  (Array.isArray(raw.cards) ? raw.cards : []).forEach(function (e, i) {
    var where = "カード" + (i + 1) + "番目";
    if (!e || typeof e !== "object") return bad(where, "書き方がちがいます");
    if (CARD_KINDS.indexOf(e.kind) < 0) return bad(where, "kind \"" + e.kind + "\" という カードは ありません");
    var c = { kind: e.kind, title: text(e, "title") || e.kind, text: text(e, "text") };
    if (e.kind === "steal") c.point = point(where, e, RANGES.steal);
    if (e.kind === "boost") {
      c.steps = isNum(e.steps) ? clampTo(Math.round(e.steps), RANGES.boost) : 2;
      if (isNum(e.steps) && c.steps !== e.steps) bad(where, "steps は 1〜3 にしてください（" + c.steps + " にしました）");
    }
    // 売店の 値段・1回のプレイで 売る まいすうの 上限・2番目の売店だけで 売る
    c.price = isNum(e.price) ? clampTo(Math.round(e.price), RANGES.price) : 30;
    if (isNum(e.price) && c.price !== e.price) bad(where, "price は 10〜100 にしてください（" + c.price + " にしました）");
    if (e.max !== undefined) {
      c.max = isNum(e.max) ? clampTo(Math.round(e.max), RANGES.max) : 2;
      if (c.max !== e.max) bad(where, "max は 1〜5 にしてください（" + c.max + " にしました）");
    }
    if (e.shop !== undefined) {
      if (e.shop === "second") c.shop = "second";
      else bad(where, "shop は \"second\" だけ 書けます");
    }
    out.cards.push(c);
  });

  // ハードモードの売店（カード以外の 商品と、ならべる数）
  if (raw.shop) {
    var sh = raw.shop, ts = sh.tshirt || {};
    out.shop = {
      size: isNum(sh.size) ? clampTo(Math.round(sh.size), [2, 7]) : 5,
      tshirt: { title: text(ts, "title") || "I♥佐渡Tシャツ", text: text(ts, "text"),
        price: isNum(ts.price) ? clampTo(Math.round(ts.price), RANGES.price) : 50 }
    };
  }

  // ハードモードのかけひき
  (Array.isArray(raw.rival) ? raw.rival : []).forEach(function (e, i) {
    var where = "かけひきイベント" + (i + 1) + "番目";
    if (!e || typeof e !== "object") return bad(where, "書き方がちがいます");
    if (RIVAL_KINDS.indexOf(e.kind) < 0) return bad(where, "kind \"" + e.kind + "\" という かけひきは ありません");
    var r = { kind: e.kind, title: text(e, "title") || "かけひき", text: text(e, "text") };
    if (RANGES[e.kind]) r.point = point(where, e, RANGES[e.kind]);
    out.rival.push(r);
  });

  // マスとイベントがつながっているか
  (squares || []).forEach(function (sq, i) {
    if (sq.type === "place" && !out.places[sq.event]) {
      problems.push(label + "マス" + i + "のデータに問題あり：event \"" + sq.event + "\" が data/events.js の places にありません");
    } else if (sq.type !== "place" && sq.type !== "start" && sq.event && !out.fixed[sq.event]) {
      problems.push(label + "マス" + i + "のデータに問題あり：event \"" + sq.event + "\" が data/events.js の fixed にありません");
    }
  });
  if ((squares || []).some(function (sq) { return sq.type === "card" || sq.type === "shop"; }) && !out.cards.length) problems.push("カードが1まいも ありません（data/adult/events.js の cards）");
  if ((squares || []).some(function (sq) { return sq.type === "shop"; }) && !out.shop) problems.push("売店の データが ありません（data/adult/events.js の shop）");
  if ((squares || []).some(function (sq) { return sq.type === "rival"; }) && !out.rival.length) problems.push("かけひきイベントが1つも ありません（data/adult/events.js の rival）");
  ["lucky", "happening", "move"].forEach(function (key) {
    var used = (squares || []).some(function (sq) { return sq.type === key && !sq.event; });
    if (used && !out[key].length) problems.push("data/events.js に " + key + " のイベントが1つもありません");
  });

  return { events: out, problems: problems };
}
// ---------- クイズ（data/quizzes.js） ----------

function checkQuizzes(raw, file) {
  var problems = [];
  var out = [];
  file = file || "data/quizzes.js";
  if (!Array.isArray(raw)) {
    problems.push(file + " が読みこめません。カッコや「,」の書き間違いがないか確認してください。");
    return { quizzes: out, problems: problems };
  }
  raw.forEach(function (q, i) {
    var where = (file === "data/quizzes.js" ? "" : file + " の ") + "クイズ" + (i + 1) + "問目";
    function bad(msg) { problems.push(where + "のデータに問題あり：" + msg); }
    if (!q || typeof q !== "object" || typeof q.question !== "string") return bad("question（問題文）がありません");
    if (!Array.isArray(q.choices) || q.choices.length !== 3) return bad("choices（こたえ）は3つにしてください");
    if (!isNum(q.answer) || q.answer < 0 || q.answer > 2) return bad("answer は 0・1・2 のどれかにしてください");
    var point = isNum(q.point) ? clampTo(q.point, RANGES.quiz) : 30;
    if (isNum(q.point) && point !== q.point) bad("point は 10〜30 にしてください（" + point + " にしました）");
    out.push({ question: q.question, choices: q.choices.map(String), answer: q.answer,
      explain: typeof q.explain === "string" ? q.explain : "", point: point });
  });
  if (out.length < 10) problems.push("クイズが " + out.length + "問 です。同じ問題が出やすいので、10問以上にしてください");
  return { quizzes: out, problems: problems };
}