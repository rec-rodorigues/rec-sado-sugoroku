// =====================================================
// 地図
// OpenStreetMap の地図（タイル）を Leaflet で表示し、その上にマスとコマを置く。
// 地図の画像はインターネットから読みこむ。
// =====================================================

var MapView = (function () {
  "use strict";

  var TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  var ZOOM = 12;           // はじめのカメラの近さ（大きいほど近い。12で島の半分くらいが見える）
  var FIT_MIN_ZOOM = 10.5; // マスの間がはなれているときでも、これより小さくはしない
  var FIT_MAX_ZOOM = 14;   // マスがこみあっているときでも、これより大きくはしない
  var EVENT_SPACE = 150;   // イベントカードの上にコマが見えるように（px）
  var MIN_ZOOM = 9;        // 手で いちばん小さくしたとき（島全体が見える）
  var MAX_ZOOM = 17;       // 手で いちばん大きくしたとき
  var SADO_BOUNDS = [[37.55, 137.85], [38.6, 138.85]]; // ここより外へは動かせない

  // 同じマスに何人いても重ならないよう、プレイヤーごとに少しずらす（px）
  var KOMA_OFFSETS = [[-9, -9], [9, -9], [-9, 9], [9, 9]];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function isBig(s) { return s.type === "place" || s.type === "start"; }

  // 名所マスの中の星と、両津港の船
  var STAR = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8z" fill="#fff"/></svg>';
  var SHIP = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 15h18l-3 5H6z M7 14V9h10v5 M10 9V5h4v4" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  // マスの見た目。名所はいつも名前（ふりがな付き）を出す。かならず止まるマスには「とまる」の印
  function squareHtml(s, i) {
    var inner = s.type === "start" ? SHIP : isBig(s) ? STAR : String(i);
    var html = '<div class="sq sq-' + s.type + (isBig(s) ? " sq-big" : "") + (s.stop ? " sq-stop" : "") + '"><span>' + inner + "</span></div>";
    if (isBig(s)) {
      var name = s.yomi ? "<ruby>" + esc(s.name) + "<rt>" + esc(s.yomi) + "</rt></ruby>" : esc(s.name);
      if (s.type === "start") name += "<small>スタート・ゴール</small>";
      if (s.stop) name += "<small class='stop-note'>かならず とまる</small>";
      html += '<div class="sq-name">' + name + "</div>";
    }
    return html;
  }

  function squareIcon(s, i) {
    return L.divIcon({ className: "sq-wrap", html: squareHtml(s, i), iconSize: [0, 0] });
  }

  // マスとマスをなめらかな曲線でつなぐ（実際の道ではなく、見やすさ優先）
  function makeRoute(squares) {
    var n = squares.length, SAMPLES = 8, TENSION = 0.5;
    var xy = squares.map(function (s) { return Roads.toXY(s.lat, s.lng); });
    var latlngs = [];
    for (var i = 0; i < n; i++) {
      var p0 = xy[(i - 1 + n) % n], p1 = xy[i], p2 = xy[(i + 1) % n], p3 = xy[(i + 2) % n];
      for (var k = 0; k < SAMPLES; k++) {
        var t = k / SAMPLES, t2 = t * t, t3 = t2 * t;
        // カーディナル・スプライン（マスを必ず通る曲線）
        var m1 = [(p2[0] - p0[0]) * TENSION, (p2[1] - p0[1]) * TENSION];
        var m2 = [(p3[0] - p1[0]) * TENSION, (p3[1] - p1[1]) * TENSION];
        var h1 = 2 * t3 - 3 * t2 + 1, h2 = t3 - 2 * t2 + t, h3 = -2 * t3 + 3 * t2, h4 = t3 - t2;
        latlngs.push(Roads.toLatLng([
          h1 * p1[0] + h2 * m1[0] + h3 * p2[0] + h4 * m2[0],
          h1 * p1[1] + h2 * m1[1] + h3 * p2[1] + h4 * m2[1]
        ]));
      }
    }
    latlngs.push(latlngs[0]);
    return latlngs;
  }

  // opts.edit が true のときは「編集モード」：マスをドラッグで動かせて、地図をクリックすると緯度・経度がわかる
  //   opts.onMapClick(lat, lng) / opts.onSquareMoved(i, lat, lng) / opts.onSquareClick(i)
  function create(container, minimapContainer, offlineNote, squares, players, opts) {
    opts = opts || {};
    var edit = !!opts.edit;
    // ドラッグ・ホイール・ダブルクリックで見る場所や大きさを変えられる（コマが動いている間は止める）
    var map = L.map(container, {
      zoomControl: false, boxZoom: false, keyboard: false,
      minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, zoomSnap: 0.5, wheelPxPerZoomLevel: 120,
      maxBounds: SADO_BOUNDS, maxBoundsViscosity: 0.8
    });
    map.attributionControl.setPrefix(false);
    map.setView([squares[0].lat, squares[0].lng], ZOOM);

    // 地図の画像。読みこめないときはお知らせを出す
    var tiles = L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: "地図データ © OpenStreetMap contributors"
    }).addTo(map);
    var loaded = 0;
    tiles.on("tileload", function () { loaded++; offlineNote.hidden = true; });
    tiles.on("tileerror", function () { if (!loaded) offlineNote.hidden = false; });

    // すごろくの道
    var routeCasing = L.polyline([], { className: "route-casing", interactive: false }).addTo(map);
    var routeLine = L.polyline([], { className: "route", interactive: false }).addTo(map);
    function drawRoute() {
      var route = makeRoute(squares);
      routeCasing.setLatLngs(route);
      routeLine.setLatLngs(route);
    }
    drawRoute();

    // マス
    var markers = squares.map(function (s, i) {
      var m = L.marker([s.lat, s.lng], {
        icon: squareIcon(s, i), interactive: edit, draggable: edit, keyboard: false,
        zIndexOffset: isBig(s) ? 500 : 0
      }).addTo(map);
      if (edit) {
        m.on("click", function () { if (opts.onSquareClick) opts.onSquareClick(i); });
        m.on("dragend", function () {
          var ll = m.getLatLng();
          s.lat = Math.round(ll.lat * 100000) / 100000;
          s.lng = Math.round(ll.lng * 100000) / 100000;
          drawRoute();
          if (opts.onSquareMoved) opts.onSquareMoved(i, s.lat, s.lng);
        });
      }
      return m;
    });
    if (edit) {
      map.on("click", function (e) {
        if (opts.onMapClick) opts.onMapClick(Math.round(e.latlng.lat * 100000) / 100000, Math.round(e.latlng.lng * 100000) / 100000);
      });
    }


    // コマ
    var komas = players.map(function (p, i) {
      var o = KOMA_OFFSETS[i % KOMA_OFFSETS.length];
      var html = '<div class="koma" style="left:' + o[0] + "px;top:" + o[1] + 'px">' +
        '<span class="koma-ring"></span>' + komaIcon(p.koma, 34) + "</div>";
      return L.marker([squares[0].lat, squares[0].lng], {
        icon: L.divIcon({ className: "koma-wrap", html: html, iconSize: [0, 0] }),
        interactive: false, keyboard: false, zIndexOffset: 1000 + i
      }).addTo(map);
    });

    var mini = createMinimap(minimapContainer, squares, players);
    komas.forEach(function (_, i) { mini.move(i, squares[0]); });

    // ズームアウトすると名前がかさなるので、小さくする・かくす
    function updateLabels() {
      var z = map.getZoom();
      container.classList.toggle("zoom-mid", z < 12 && z >= 11);
      container.classList.toggle("zoom-far", z < 11);
    }
    map.on("zoomend", updateLabels);
    updateLabels();

    // 全体地図に、いま画面に映っている範囲の枠を出す
    function updateView() { mini.view(map.getBounds()); }
    map.on("move", updateView);
    updateView();

    // 地図の上のボタン（＋・−・コマへ もどる）
    var tools = document.createElement("div");
    tools.className = "map-tools";
    tools.innerHTML =
      '<button type="button" data-act="in" aria-label="大きくする">＋</button>' +
      '<button type="button" data-act="out" aria-label="小さくする">−</button>' +
      '<button type="button" data-act="back" class="map-back">コマへ<br>もどる</button>';
    container.parentNode.appendChild(tools);
    tools.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.act === "in") map.zoomIn(1);
      if (b.dataset.act === "out") map.zoomOut(1);
      if (b.dataset.act === "back") showSquares(lastShown);
    });

    // 全体地図をクリックすると、その場所を見る
    mini.onClick(function (ll) { if (interactive) map.panTo(ll); });

    var interactive = true;
    function setInteractive(on) {
      interactive = on;
      ["dragging", "scrollWheelZoom", "doubleClickZoom", "touchZoom"].forEach(function (h) {
        if (map[h]) map[h][on ? "enable" : "disable"]();
      });
      tools.classList.toggle("locked", !on);
      Array.prototype.forEach.call(tools.querySelectorAll("button"), function (b) { b.disabled = !on; });
    }

    // いくつかのマスが ちょうど入るように、カメラを合わせる。
    // マスの間がはなれていれば小さく（ズームアウト）、こみあっていれば大きく（ズームイン）なる
    var lastShown = [0];
    function showSquares(list) {
      lastShown = list;
      var b = L.latLngBounds(list.map(function (k) { return [squares[k].lat, squares[k].lng]; }));
      var zoom = map.getBoundsZoom(b, false, L.point(140, 160));
      zoom = Math.max(FIT_MIN_ZOOM, Math.min(FIT_MAX_ZOOM, Math.floor(zoom * 2) / 2));
      map.setView(b.getCenter(), zoom, { animate: true, duration: 0.5 });
    }

    // 移動中：コマが画面のはしに近づいたら、追いかける
    function follow(sqIndex) {
      var ll = L.latLng(squares[sqIndex].lat, squares[sqIndex].lng);
      if (!map.getBounds().pad(-0.15).contains(ll)) map.panTo(ll, { animate: true, duration: 0.3 });
    }

    function moveKoma(i, sqIndex) {
      var s = squares[sqIndex];
      komas[i].setLatLng([s.lat, s.lng]);
      mini.move(i, s);
      // ピョンと跳ねる
      var el = komas[i].getElement();
      var k = el && el.querySelector(".koma");
      if (k) {
        k.classList.remove("hop");
        void k.offsetWidth; // アニメーションを最初からやり直す
        k.classList.add("hop");
      }
    }

    // イベント中は少しズームして、コマをカードの上に見せる
    function focus(sqIndex) {
      var s = squares[sqIndex];
      var z = Math.max(12.5, Math.min(FIT_MAX_ZOOM, map.getZoom() + 0.5));
      var p = map.project([s.lat, s.lng], z).add([0, EVENT_SPACE]);
      map.setView(map.unproject(p, z), z, { animate: true });
    }

    return {
      moveKoma: moveKoma,
      follow: follow,
      showSquares: showSquares,
      focus: focus,
      setInteractive: setInteractive,
      setActive: function (i) {
        komas.forEach(function (m, k) {
          var el = m.getElement();
          if (el) el.classList.toggle("active", k === i);
          m.setZIndexOffset(k === i ? 2000 : 1000 + k);
        });
        mini.setActive(i);
      },
      destroy: function () {
        map.remove();
        tools.remove();
        minimapContainer.innerHTML = "";
        offlineNote.hidden = true;
      }
    };
  }

  // 右上の小さな全体地図（海岸線は js/map-data.js から）
  function createMinimap(container, squares, players) {
    var NS = "http://www.w3.org/2000/svg";
    function el(tag, attrs, parent) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      parent.appendChild(e);
      return e;
    }
    var coast = window.MAP_DATA ? window.MAP_DATA.coast : [];
    var xy = squares.map(function (s) { return Roads.toXY(s.lat, s.lng); });
    var xs = xy.map(function (p) { return p[0]; }), ys = xy.map(function (p) { return p[1]; });
    coast.forEach(function (ring) { ring.forEach(function (v, i) { (i % 2 ? ys : xs).push(v); }); });
    var pad = 60;
    var x0 = Math.min.apply(null, xs) - pad, y0 = Math.min.apply(null, ys) - pad;
    var w = Math.max.apply(null, xs) + pad - x0, h = Math.max.apply(null, ys) + pad - y0;

    var svg = el("svg", { viewBox: x0 + " " + y0 + " " + w + " " + h, "class": "minimap-svg" }, container);
    coast.forEach(function (ring) {
      var d = "M" + ring.slice(0, 2).join(" ");
      for (var i = 2; i + 1 < ring.length; i += 2) d += "L" + ring[i] + " " + ring[i + 1];
      el("path", { d: d + "Z", "class": "mini-land" }, svg);
    });
    el("path", { d: "M" + xy.map(function (p) { return p.join(" "); }).join("L") + "Z", "class": "mini-route" }, svg);
    squares.forEach(function (s, i) {
      if (isBig(s)) el("circle", { cx: xy[i][0], cy: xy[i][1], r: 30, "class": "mini-place" }, svg);
    });
    var frame = el("rect", { "class": "mini-view", rx: 20 }, svg);
    var dots = players.map(function (p) {
      return el("circle", { r: 50, fill: p.koma.color, "class": "mini-koma" }, svg);
    });

    return {
      move: function (i, s) {
        var p = Roads.toXY(s.lat, s.lng), o = KOMA_OFFSETS[i % KOMA_OFFSETS.length];
        dots[i].setAttribute("cx", p[0] + o[0] * 3);
        dots[i].setAttribute("cy", p[1] + o[1] * 3);
      },
      view: function (b) {
        var a = Roads.toXY(b.getNorth(), b.getWest()), c = Roads.toXY(b.getSouth(), b.getEast());
        frame.setAttribute("x", a[0]); frame.setAttribute("y", a[1]);
        frame.setAttribute("width", c[0] - a[0]); frame.setAttribute("height", c[1] - a[1]);
      },
      onClick: function (fn) {
        svg.addEventListener("click", function (e) {
          var pt = svg.createSVGPoint();
          pt.x = e.clientX; pt.y = e.clientY;
          var p = pt.matrixTransform(svg.getScreenCTM().inverse());
          fn(Roads.toLatLng([p.x, p.y]));
        });
      },
      setActive: function (i) {
        dots.forEach(function (d, k) { d.classList.toggle("active", k === i); });
        svg.appendChild(dots[i]);
      }
    };
  }

  return { create: create };
})();

// コマの見た目：プレイヤーの色の台に、キャラクターの絵（images/koma/）がのっている
function komaIcon(k, px) {
  return '<span class="koma-icon" style="width:' + px + "px;height:" + px + "px;background:" + k.color + '">' +
    '<img src="' + k.image + '" alt="" draggable="false"></span>';
}

// 佐渡の形のシルエット（タイトル画面などのかざり。js/map-data.js の海岸線から）
function sadoSilhouette(cls) {
  var coast = window.MAP_DATA ? window.MAP_DATA.coast : [];
  if (!coast.length) return "";
  var xs = [], ys = [], d = "";
  coast.forEach(function (ring) {
    ring.forEach(function (v, i) { (i % 2 ? ys : xs).push(v); });
    d += "M" + ring.slice(0, 2).join(" ");
    for (var i = 2; i + 1 < ring.length; i += 2) d += "L" + ring[i] + " " + ring[i + 1];
    d += "Z";
  });
  var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
  var w = Math.max.apply(null, xs) - x0, h = Math.max.apply(null, ys) - y0;
  return '<svg class="' + cls + '" viewBox="' + x0 + " " + y0 + " " + w + " " + h + '" aria-hidden="true"><path d="' + d + '"/></svg>';
}