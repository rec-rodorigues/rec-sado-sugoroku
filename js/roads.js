// =====================================================
// 道路のつながり（マスとマスの間を、実際の道に沿った線でつなぐ）
// =====================================================

var Roads = (function () {
  "use strict";

  var MAX_SNAP = 120; // マスから道まで、これ以上遠ければ（約2km）まっすぐの線でつなぐ
  var PENALTY = 4;    // 一度通った道は通りにくくする（行きと帰りで同じ道を重ねないため）

  // 緯度・経度 ⇔ 道路データの座標（tools/make-map.ps1 と同じ計算。1km ≒ 60）
  var LON0 = 138.18, LAT0 = 38.36, KX = 5259, KY = 6660;
  function toXY(lat, lng) { return [(lng - LON0) * KX, (LAT0 - lat) * KY]; }
  function toLatLng(p) { return [LAT0 - p[1] / KY, LON0 + p[0] / KX]; }

  function dist(ax, ay, bx, by) {
    return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
  }

  // MAP_DATA.roads から、交差点を点、道を線とするグラフを作る
  function build(roads) {
    var index = {}, nodes = [], edges = [];
    function node(p) {
      var k = p[0] + "," + p[1];
      if (!(k in index)) { index[k] = nodes.length; nodes.push([]); }
      return index[k];
    }
    roads.forEach(function (r) {
      var pts = [];
      for (var i = 1; i + 1 < r.length; i += 2) pts.push([r[i], r[i + 1]]);
      if (pts.length < 2) return;
      var cum = [0];
      for (var j = 1; j < pts.length; j++) {
        cum.push(cum[j - 1] + dist(pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1]));
      }
      var e = { id: edges.length, a: node(pts[0]), b: node(pts[pts.length - 1]), pts: pts, cum: cum, len: cum[cum.length - 1] };
      edges.push(e);
      nodes[e.a].push(e.id);
      if (e.b !== e.a) nodes[e.b].push(e.id);
    });
    return { nodes: nodes, edges: edges };
  }

  // 点 p にいちばん近い道の上の場所
  function snap(g, p) {
    var best = null;
    g.edges.forEach(function (e) {
      for (var i = 0; i + 1 < e.pts.length; i++) {
        var a = e.pts[i], b = e.pts[i + 1];
        var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
        var t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
        var x = a[0] + dx * t, y = a[1] + dy * t, d = dist(p[0], p[1], x, y);
        if (!best || d < best.d) best = { e: e, d: d, pt: [x, y], along: e.cum[i] + Math.sqrt(l2) * t };
      }
    });
    return best;
  }

  function pointAt(e, s) {
    for (var i = 0; i + 1 < e.pts.length; i++) {
      if (s <= e.cum[i + 1] || i + 2 === e.pts.length) {
        var seg = e.cum[i + 1] - e.cum[i], t = seg ? (s - e.cum[i]) / seg : 0;
        var a = e.pts[i], b = e.pts[i + 1];
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      }
    }
    return e.pts[0];
  }

  // 道 e の上を、from の位置から to の位置まで進む点の列
  function partial(e, from, to) {
    var out = [pointAt(e, from)];
    var i;
    if (from <= to) {
      for (i = 0; i < e.pts.length; i++) if (e.cum[i] > from && e.cum[i] < to) out.push(e.pts[i]);
    } else {
      for (i = e.pts.length - 1; i >= 0; i--) if (e.cum[i] < from && e.cum[i] > to) out.push(e.pts[i]);
    }
    out.push(pointAt(e, to));
    return out;
  }

  // A から B までの道に沿った点の列。used に通った道を記録する
  function route(g, A, B, used) {
    var sa = snap(g, A), sb = snap(g, B);
    if (!sa || !sb || sa.d > MAX_SNAP || sb.d > MAX_SNAP) return [A, B];

    function w(e) { return used[e.id] ? PENALTY : 1; }
    var ea = sa.e, eb = sb.e;
    var best = Infinity, bestPts = null, bestEdges = null;

    if (ea === eb) {
      best = Math.abs(sa.along - sb.along) * w(ea);
      bestPts = partial(ea, sa.along, sb.along);
      bestEdges = [ea.id];
    }

    // ダイクストラ法で、いちばん近い道順をさがす
    var n = g.nodes.length;
    var d = new Array(n), prev = new Array(n), done = new Array(n);
    for (var i = 0; i < n; i++) { d[i] = Infinity; prev[i] = -1; done[i] = false; }
    d[ea.a] = sa.along * w(ea);
    d[ea.b] = Math.min(d[ea.b], (ea.len - sa.along) * w(ea));
    for (;;) {
      var u = -1;
      for (i = 0; i < n; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
      if (u < 0 || d[u] >= best) break;
      done[u] = true;
      g.nodes[u].forEach(function (id) {
        var e = g.edges[id], v = e.a === u ? e.b : e.a, c = d[u] + e.len * w(e);
        if (c < d[v]) { d[v] = c; prev[v] = id; }
      });
    }

    [[eb.a, sb.along], [eb.b, eb.len - sb.along]].forEach(function (end) {
      var c = d[end[0]] + end[1] * w(eb);
      if (c >= best) return;
      // 道順を後ろからたどる
      var chain = [], cur = end[0];
      while (prev[cur] !== -1) {
        var e = g.edges[prev[cur]];
        chain.unshift({ e: e, to: cur });
        cur = e.a === cur ? e.b : e.a;
      }
      var pts = partial(ea, sa.along, cur === ea.a ? 0 : ea.len);
      chain.forEach(function (step) {
        var p = step.e.pts.slice();
        if (step.e.a === step.to && step.e.b !== step.to) p.reverse();
        pts = pts.concat(p.slice(1));
      });
      pts = pts.concat(partial(eb, end[0] === eb.a ? 0 : eb.len, sb.along).slice(1));
      best = c;
      bestPts = pts;
      bestEdges = [ea.id, eb.id].concat(chain.map(function (s) { return s.e.id; }));
    });

    if (!bestPts) return [A, B];
    bestEdges.forEach(function (id) { used[id] = true; });
    return [A].concat(bestPts, [B]);
  }

  // 点の列の長さと、ちょうど s の位置の点
  function length(pts) {
    var l = 0;
    for (var i = 1; i < pts.length; i++) l += dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    return l;
  }
  function along(pts, s) {
    for (var i = 1; i < pts.length; i++) {
      var seg = dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      if (s <= seg) {
        var t = seg ? s / seg : 0;
        return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
      }
      s -= seg;
    }
    return pts[pts.length - 1];
  }

  // 名所の間に、ふつうのマスを道の上に等間隔で置いた緯度・経度を出す（マスを置き直すときの道具）
  // 使い方：ブラウザのコンソールで Roads.suggestSquares(SQUARES) を実行する
  // waypoints（任意）：{ 名所のid: [[lat, lng], ...] } その名所から次の名所へ行くときに通る場所
  function suggestSquares(squares, waypoints) {
    var g = build(window.MAP_DATA.roads);
    var used = {};
    var GAP = 56; // ほかのマスとこれだけ離す（約1km）
    var keys = [];
    squares.forEach(function (s, i) { if (s.type === "place" || s.type === "start") keys.push(i); });
    var xy = squares.map(function (s) { return toXY(s.lat, s.lng); });
    var placed = keys.map(function (k) { return xy[k]; });
    var out = squares.map(function (s) { return { id: s.id, lat: s.lat, lng: s.lng }; });

    keys.forEach(function (k, n) {
      var next = keys[(n + 1) % keys.length];
      var count = (next - k - 1 + squares.length) % squares.length;
      var stops = [xy[k]];
      ((waypoints && waypoints[k]) || []).forEach(function (w) { stops.push(snap(g, toXY(w[0], w[1])).pt); });
      stops.push(xy[next]);
      var pts = [];
      for (var i = 0; i + 1 < stops.length; i++) pts = pts.concat(route(g, stops[i], stops[i + 1], used));
      var len = length(pts);

      // 道の上を少しずつ見ていき、ほかのマスから離れている場所だけを候補にする
      var free = [];
      for (var s = 0; s <= len; s += 2) {
        var p = along(pts, s);
        if (placed.every(function (q) { return dist(q[0], q[1], p[0], p[1]) >= GAP; })) free.push(p);
      }
      if (free.length < count) free = [];
      for (var j = 1; j <= count; j++) {
        var pt = free.length ? free[Math.round((free.length - 1) * (j - 0.5) / count)] : along(pts, len * j / (count + 1));
        var ll = toLatLng(pt);
        var idx = (k + j) % squares.length;
        out[idx].lat = Math.round(ll[0] * 100000) / 100000;
        out[idx].lng = Math.round(ll[1] * 100000) / 100000;
        placed.push(pt);
      }
    });
    return out;
  }

  // いちばん近い道路の上の緯度・経度（マスを道の上に置き直すときの道具）
  // 使い方：ブラウザのコンソールで Roads.nearestRoad(38.07, 138.43) を実行する
  var cachedGraph = null;
  function nearestRoad(lat, lng) {
    cachedGraph = cachedGraph || build(window.MAP_DATA.roads);
    var ll = toLatLng(snap(cachedGraph, toXY(lat, lng)).pt);
    return [Math.round(ll[0] * 100000) / 100000, Math.round(ll[1] * 100000) / 100000];
  }

  // 海岸線までのきょり（km）。js/map-data.js の海岸線を使う
  function coastDistanceKm(lat, lng) {
    var p = toXY(lat, lng), best = Infinity;
    ((window.MAP_DATA && window.MAP_DATA.coast) || []).forEach(function (ring) {
      for (var i = 0; i + 3 < ring.length; i += 2) {
        var ax = ring[i], ay = ring[i + 1], bx = ring[i + 2], by = ring[i + 3];
        var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        var t = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)) : 0;
        best = Math.min(best, dist(p[0], p[1], ax + dx * t, ay + dy * t));
      }
    });
    return best / 60; // 60 = 1km
  }

  return {
    coastDistanceKm: coastDistanceKm,
    build: build, route: route, length: length, along: along,
    toXY: toXY, toLatLng: toLatLng, suggestSquares: suggestSquares, nearestRoad: nearestRoad
  };
})();
