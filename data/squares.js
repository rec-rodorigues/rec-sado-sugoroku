// =====================================================
// マスの並び・種類・場所
// =====================================================
// 両津港（id: 0）からスタートして、id の順に進み、両津港にもどってゴール。
//
// type（マスの種類）
//   "start"     … 両津港（スタート・ゴール）
//   "place"     … 名所マス（金）
//   "lucky"     … ラッキーマス（青）
//   "quiz"      … クイズマス（黄）
//   "happening" … ハプニングマス（赤）
//   "move"      … すすむ・もどるマス（緑）
//
// lat, lng … 場所（緯度・経度）。Googleマップなどで場所を右クリックすると出る数字
//            名所は実際の場所、ふつうのマスは名所の間の道路の上に置いてある
// name     … 名前（名所マスと両津港だけ）。地図にいつも出る
// yomi     … 名前のよみがな（名前の上に小さく出る）
// event    … イベントの id。名所は data/events.js の places、ほかのマスは fixed の id を書くと
//            そのマスでは いつも そのイベントが起きる（書かなければ、種類ごとのリストから選ばれる）
// stop     … true にすると、出た目が あまっていても そのマスで止まる
//
// ※ id は 0 から順番に、とばさずに付けてください。
// ※ 行の最後の「,」を忘れないように。

window.SQUARES = [
  { id: 0,  type: "start", name: "両津港", yomi: "りょうつこう", lat: 38.08165, lng: 138.43807 },

  { id: 1,  type: "lucky",     lat: 38.08185, lng: 138.41934, event: "ilovesado" }, // I♥佐渡（決まったイベント）
  { id: 2,  type: "quiz",      lat: 38.06561, lng: 138.40547 },
  { id: 3,  type: "lucky",     lat: 38.04749, lng: 138.40521 },
  { id: 4,  type: "place", name: "トキの森公園", yomi: "ときのもりこうえん", lat: 38.03728, lng: 138.42195, event: "toki", stop: true },

  { id: 5,  type: "quiz",      lat: 38.03998, lng: 138.43992 },
  { id: 6,  type: "happening", lat: 38.14257, lng: 138.44906 },
  { id: 7,  type: "lucky",     lat: 38.22698, lng: 138.49574 },
  { id: 8,  type: "move",      lat: 38.31928, lng: 138.51335 },
  { id: 9,  type: "place", name: "大野亀", yomi: "おおのがめ", lat: 38.32098, lng: 138.46123, event: "onogame" },

  { id: 10, type: "quiz",      lat: 38.28364, lng: 138.44486 },
  { id: 11, type: "lucky",     lat: 38.21902, lng: 138.37292 },
  { id: 12, type: "happening", lat: 38.14977, lng: 138.30218 },
  { id: 13, type: "quiz",      lat: 38.0728, lng: 138.24634 },
  { id: 14, type: "place", name: "佐渡金山", yomi: "さどきんざん", lat: 38.04089, lng: 138.25865, event: "kinzan", stop: true },

  { id: 15, type: "lucky",     lat: 38.02252, lng: 138.24273 },
  { id: 16, type: "move",      lat: 38.0024, lng: 138.27414 },
  { id: 17, type: "quiz",      lat: 38.0036, lng: 138.31413 },
  { id: 18, type: "lucky",     lat: 37.97524, lng: 138.34766 },
  { id: 19, type: "place", name: "大膳神社", yomi: "だいぜんじんじゃ", lat: 37.97502, lng: 138.36418, event: "daizen" }, // 妙宣寺と重ならないよう、実際より約300m西

  { id: 20, type: "happening", lat: 37.98558, lng: 138.36133 },
  { id: 21, type: "quiz",      lat: 38.00379, lng: 138.36029 },
  { id: 22, type: "place", name: "佐渡弁慶 佐渡本店", yomi: "さどべんけい さどほんてん", lat: 38.00404, lng: 138.33195, event: "benkei" },

  { id: 23, type: "lucky",     lat: 38.0054, lng: 138.37408 },
  { id: 24, type: "move",      lat: 37.98632, lng: 138.38707 },
  { id: 25, type: "place", name: "妙宣寺", yomi: "みょうせんじ", lat: 37.97025, lng: 138.37658, event: "myosenji" }, // 大膳神社と重ならないよう、実際より約300m東

  { id: 26, type: "quiz",      lat: 37.94422, lng: 138.31707 },
  { id: 27, type: "happening", lat: 37.88737, lng: 138.29157 },
  { id: 28, type: "lucky",     lat: 37.82171, lng: 138.20865 }, // 沢崎（万畳敷）
  { id: 29, type: "quiz",      lat: 37.80800, lng: 138.24400 }, // 宿根木
  { id: 30, type: "place", name: "小木港", yomi: "おぎこう", lat: 37.81626, lng: 138.28223, event: "ogi", stop: true },

  { id: 31, type: "move",      lat: 37.82558, lng: 138.32247 },
  { id: 32, type: "happening", lat: 37.84798, lng: 138.38505 },
  { id: 33, type: "lucky",     lat: 37.88317, lng: 138.43951, event: "jijii" }, // 棚田じじい（決まったイベント）
  { id: 34, type: "quiz",      lat: 37.91964, lng: 138.49064 },
  { id: 35, type: "place", name: "岩首昇竜棚田", yomi: "いわくびしょうりゅうたなだ", lat: 37.94227, lng: 138.49157, event: "iwakubi", stop: true },

  { id: 36, type: "lucky",     lat: 37.97240, lng: 138.51943 },
  { id: 37, type: "quiz",      lat: 38.03030, lng: 138.55314 },
  { id: 38, type: "happening", lat: 38.08128, lng: 138.55748 }, // 姫崎
  { id: 39, type: "move",      lat: 38.06061, lng: 138.48274, event: "kaeritakunai" } // 帰りたくない（決まったイベント）
];
