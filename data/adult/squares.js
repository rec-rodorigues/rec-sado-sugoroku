// =====================================================
// おとなモードのマス（56マス・分かれ道 2か所）
// =====================================================
// 書き方は data/squares.js（こどもモード）と同じ。おとなモードだけで使えるものは：
//
// type:
//   "card"  … カードマス（紫）：カードを1枚 引く
//   "rival" … かけひきマス（オレンジ）：ほかの人を 相手にする イベント
//
// next   … つぎに 進むマスの id（書かなければ id + 1。最後のマスの つぎは ゴール）
// branch … 分かれ道。[{ to: 行き先の id, label: "道の名前", note: "ひとこと" }, { … }]
//          そのマスを 通るときに、どちらに 行くか えらぶ
//
// 分かれ道の 書き方：分かれ道のマス → 1本目の道 → 2本目の道 → 合流するマス の順に ならべる。
// 1本目の道の 最後のマスには next: 合流するマスの id を 書く。
//
// ※ id は 0 から順番に、とばさずに付けてください。

window.ADULT_SQUARES = [
  { id: 0,  type: "start", name: "両津港", yomi: "りょうつこう", lat: 38.08165, lng: 138.43807,
    branch: [{ to: 1, label: "北の海岸コース", note: "二ツ亀・大野亀・尖閣湾（遠回り）" },
             { to: 15, label: "山こえコース", note: "トキの森公園・白雲台（近道）" }] },

  // ---- 北の海岸コース（1〜14） ----
  { id: 1,  type: "quiz",      lat: 38.13504, lng: 138.44714 },
  { id: 2,  type: "lucky",     lat: 38.18693, lng: 138.47863 },
  { id: 3,  type: "card",      lat: 38.24036, lng: 138.49949 },
  { id: 4,  type: "happening", lat: 38.29586, lng: 138.50773 },
  { id: 5,  type: "place", name: "二ツ亀", yomi: "ふたつがめ", lat: 38.3283, lng: 138.4870, event: "futatsugame" },
  { id: 6,  type: "rival",     lat: 38.32151, lng: 138.47615 },
  { id: 7,  type: "place", name: "大野亀", yomi: "おおのがめ", lat: 38.32098, lng: 138.46123, event: "onogame" },
  { id: 8,  type: "lucky",     lat: 38.28788, lng: 138.44643 },
  { id: 9,  type: "quiz",      lat: 38.2514, lng: 138.41845 },
  { id: 10, type: "card",      lat: 38.2155, lng: 138.36853 },
  { id: 11, type: "move",      lat: 38.18178, lng: 138.31866 },
  { id: 12, type: "happening", lat: 38.13477, lng: 138.29254 },
  { id: 13, type: "place", name: "尖閣湾", yomi: "せんかくわん", lat: 38.09519, lng: 138.25856, event: "senkaku" },
  { id: 14, type: "lucky",     lat: 38.06039, lng: 138.2381, next: 23 },

  // ---- 山こえコース（15〜22） ----
  { id: 15, type: "card",      lat: 38.07657, lng: 138.41538 },
  { id: 16, type: "quiz",      lat: 38.05263, lng: 138.40196 },
  { id: 17, type: "place", name: "トキの森公園", yomi: "ときのもりこうえん", lat: 38.03728, lng: 138.42195, event: "toki" },
  { id: 18, type: "happening", lat: 38.04479, lng: 138.38892 },
  { id: 19, type: "rival",     lat: 38.056, lng: 138.352 },
  { id: 20, type: "place", name: "白雲台", yomi: "はくうんだい", lat: 38.0637, lng: 138.3186, event: "hakuuntai" },
  { id: 21, type: "lucky",     lat: 38.06924, lng: 138.29867 },
  { id: 22, type: "quiz",      lat: 38.04935, lng: 138.28163 },

  // ---- 合流：相川・国仲 ----
  { id: 23, type: "place", name: "佐渡金山", yomi: "さどきんざん", lat: 38.04089, lng: 138.25865, event: "kinzan", stop: true },
  { id: 24, type: "place", name: "佐渡奉行所", yomi: "さどぶぎょうしょ", lat: 38.0226, lng: 138.2420, event: "bugyosho" },
  { id: 25, type: "card",      lat: 38.00707, lng: 138.2603 },
  { id: 26, type: "quiz",      lat: 38.0066, lng: 138.28416 },
  { id: 27, type: "rival",     lat: 38.00717, lng: 138.31092 },
  { id: 28, type: "place", name: "佐渡弁慶 佐渡本店", yomi: "さどべんけい さどほんてん", lat: 38.00404, lng: 138.33195, event: "benkei" },
  { id: 29, type: "lucky",     lat: 38.00379, lng: 138.36029 },
  { id: 30, type: "place", name: "大膳神社", yomi: "だいぜんじんじゃ", lat: 37.97502, lng: 138.36418, event: "daizen" },
  { id: 31, type: "happening", lat: 37.98632, lng: 138.38707 },
  { id: 32, type: "place", name: "妙宣寺", yomi: "みょうせんじ", lat: 37.97025, lng: 138.37658, event: "myosenji" },
  { id: 33, type: "card",      lat: 37.96226, lng: 138.34538 },
  { id: 34, type: "quiz",      lat: 37.94422, lng: 138.31707,
    branch: [{ to: 35, label: "海ぞいコース", note: "沢崎・宿根木（遠回り）" },
             { to: 41, label: "近道", note: "羽茂を通って 小木港へ" }] },

  // ---- 海ぞいコース（35〜40） ----
  { id: 35, type: "lucky",     lat: 37.88737, lng: 138.29157 },
  { id: 36, type: "rival",     lat: 37.84, lng: 138.255 },
  { id: 37, type: "lucky",     lat: 37.82171, lng: 138.20865 }, // 沢崎（万畳敷）
  { id: 38, type: "quiz",      lat: 37.81118, lng: 138.22518 },
  { id: 39, type: "place", name: "宿根木", yomi: "しゅくねぎ", lat: 37.808, lng: 138.244, event: "shukunegi" },
  { id: 40, type: "card",      lat: 37.81213, lng: 138.26575, next: 44 },

  // ---- 近道（41〜43） ----
  { id: 41, type: "happening", lat: 37.91083, lng: 138.32619 },
  { id: 42, type: "rival",     lat: 37.87674, lng: 138.33417 },
  { id: 43, type: "move",      lat: 37.8405, lng: 138.31302 },

  // ---- 合流：小木・東の海ぞい ----
  { id: 44, type: "place", name: "小木港", yomi: "おぎこう", lat: 37.81626, lng: 138.28223, event: "ogi", stop: true },
  { id: 45, type: "quiz",      lat: 37.82558, lng: 138.32247 },
  { id: 46, type: "card",      lat: 37.84798, lng: 138.38505 },
  { id: 47, type: "lucky",     lat: 37.88317, lng: 138.43951, event: "jijii" }, // 棚田じじい
  { id: 48, type: "rival",     lat: 37.91964, lng: 138.49064 },
  { id: 49, type: "place", name: "岩首昇竜棚田", yomi: "いわくびしょうりゅうたなだ", lat: 37.94227, lng: 138.49157, event: "iwakubi", stop: true },
  { id: 50, type: "happening", lat: 37.9724, lng: 138.51943 },
  { id: 51, type: "quiz",      lat: 37.99993, lng: 138.53811 },
  { id: 52, type: "card",      lat: 38.0303, lng: 138.55314 },
  { id: 53, type: "lucky",     lat: 38.08128, lng: 138.55748 }, // 姫崎
  { id: 54, type: "rival",     lat: 38.07207, lng: 138.52238 },
  { id: 55, type: "move",      lat: 38.06061, lng: 138.48274, event: "kaeritakunai" } // 帰りたくない
];
