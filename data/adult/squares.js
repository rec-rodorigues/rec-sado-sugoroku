// =====================================================
// ハードモードのマス（88マス・分かれ道 2か所。一周 63〜73マス）
// =====================================================
// 書き方は data/squares.js（イージーモード）と同じ。ハードモードだけで使えるものは：
//
// yomi … 読み方が むずかしい 地名にだけ 書く（地図と カードに ふりがなが 出る）
//
// type:
//   "shop"  … 売店マス（紫）：カードか I♥佐渡Tシャツを 1つ 買える。name: "売店" と stop: true を 書く
//             （ゴールから2番目に近い売店でだけ「入れ替え」を売る）
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
    branch: [{ to: 1, label: "北の海岸コース", note: "{二ツ亀|ふたつがめ}・{大野亀|おおのがめ}・{尖閣湾|せんかくわん}（遠回り）" },
             { to: 19, label: "山こえコース", note: "トキの森公園・{白雲台|はくうんだい}（近道）" }] },

  // ---- 北の海岸コース（1〜18） ----
  { id: 1,  type: "quiz",     lat: 38.13504, lng: 138.44714 },
  { id: 2,  type: "lucky",    lat: 38.18693, lng: 138.47863 },
  { id: 3,  type: "rival",    lat: 38.21169, lng: 138.49269 },
  { id: 4,  type: "lucky",    lat: 38.24036, lng: 138.49949 },
  { id: 5,  type: "happening", lat: 38.29586, lng: 138.50773 },
  { id: 6,  type: "place", name: "二ツ亀", yomi: "ふたつがめ", lat: 38.3283, lng: 138.487, event: "futatsugame" },
  { id: 7,  type: "rival",    lat: 38.32151, lng: 138.47615 },
  { id: 8,  type: "place", name: "大野亀", yomi: "おおのがめ", lat: 38.32098, lng: 138.46123, event: "onogame" },
  { id: 9,  type: "quiz",     lat: 38.28788, lng: 138.44643 },
  { id: 10, type: "rival",    lat: 38.26948, lng: 138.43855 },
  { id: 11, type: "quiz",     lat: 38.2514, lng: 138.41845 },
  { id: 12, type: "happening", lat: 38.2155, lng: 138.36853 },
  { id: 13, type: "lucky",    lat: 38.19859, lng: 138.34125 },
  { id: 14, type: "move",     lat: 38.18178, lng: 138.31866 },
  { id: 15, type: "happening", lat: 38.13477, lng: 138.29254 },
  { id: 16, type: "lucky",    lat: 38.11641, lng: 138.27306 },
  { id: 17, type: "place", name: "尖閣湾", yomi: "せんかくわん", lat: 38.09519, lng: 138.25856, event: "senkaku" },
  { id: 18, type: "lucky",    lat: 38.06039, lng: 138.2381, next: 29 },

  // ---- 山こえコース（19〜28） ----
  { id: 19, type: "lucky",    lat: 38.07657, lng: 138.41538 },
  { id: 20, type: "quiz",     lat: 38.05263, lng: 138.40196 },
  { id: 21, type: "place", name: "トキの森公園", lat: 38.03728, lng: 138.42195, event: "toki" },
  { id: 22, type: "happening", lat: 38.04479, lng: 138.38892 },
  { id: 23, type: "quiz",     lat: 38.0504, lng: 138.37046 },
  { id: 24, type: "rival",    lat: 38.056, lng: 138.352 },
  { id: 25, type: "place", name: "白雲台", yomi: "はくうんだい", lat: 38.0637, lng: 138.3186, event: "hakuuntai" },
  { id: 26, type: "lucky",    lat: 38.06924, lng: 138.29867 },
  { id: 27, type: "rival",    lat: 38.05943, lng: 138.28318 },
  { id: 28, type: "quiz",     lat: 38.04935, lng: 138.28163 },

  // ---- 合流：相川・国仲（29〜51） ----
  { id: 29, type: "place", name: "佐渡金山", lat: 38.04089, lng: 138.25865, event: "kinzan", stop: true },
  { id: 30, type: "rival",    lat: 38.03452, lng: 138.24794 },
  { id: 31, type: "place", name: "佐渡奉行所", yomi: "さどぶぎょうしょ", lat: 38.0226, lng: 138.242, event: "bugyosho" },
  { id: 32, type: "move",     lat: 38.01546, lng: 138.25221 },
  { id: 33, type: "quiz",     lat: 38.00707, lng: 138.2603 },
  { id: 34, type: "rival",    lat: 38.00195, lng: 138.27191 },
  { id: 35, type: "quiz",     lat: 38.0066, lng: 138.28416 },
  { id: 36, type: "shop", name: "売店", lat: 38.00723, lng: 138.29808, stop: true },
  { id: 37, type: "rival",    lat: 38.00717, lng: 138.31092 },
  { id: 38, type: "happening", lat: 38.00312, lng: 138.32388 },
  { id: 39, type: "place", name: "佐渡弁慶 佐渡本店", lat: 38.00404, lng: 138.33195, event: "benkei" },
  { id: 40, type: "quiz",     lat: 38.00453, lng: 138.34536 },
  { id: 41, type: "move",     lat: 38.00379, lng: 138.36029 },
  { id: 42, type: "lucky",    lat: 37.98678, lng: 138.35881 },
  { id: 43, type: "place", name: "大膳神社", yomi: "だいぜんじんじゃ", lat: 37.97502, lng: 138.36418, event: "daizen" },
  { id: 44, type: "quiz",     lat: 37.98059, lng: 138.37524 },
  { id: 45, type: "lucky",    lat: 37.98632, lng: 138.38707 },
  { id: 46, type: "happening", lat: 37.9783, lng: 138.37075 },
  { id: 47, type: "place", name: "妙宣寺", yomi: "みょうせんじ", lat: 37.97025, lng: 138.37658, event: "myosenji" },
  { id: 48, type: "rival",    lat: 37.96813, lng: 138.36164 },
  { id: 49, type: "quiz",     lat: 37.96226, lng: 138.34538 },
  { id: 50, type: "lucky",    lat: 37.95407, lng: 138.33307 },
  { id: 51, type: "quiz",     lat: 37.94422, lng: 138.31707,
    branch: [{ to: 52, label: "海ぞいコース", note: "{沢崎|さわさき}・{宿根木|しゅくねぎ}（遠回り）" },
             { to: 59, label: "近道", note: "{羽茂|はもち}を通って{小木港|おぎこう}へ" }] },

  // ---- 海ぞいコース（52〜58） ----
  { id: 52, type: "lucky",    lat: 37.88737, lng: 138.29157 },
  { id: 53, type: "happening", lat: 37.85087, lng: 138.29302 },
  { id: 54, type: "rival",    lat: 37.84, lng: 138.255 },
  { id: 55, type: "lucky",    lat: 37.82171, lng: 138.20865 }, // 沢崎（万畳敷）
  { id: 56, type: "quiz",     lat: 37.81118, lng: 138.22518 },
  { id: 57, type: "place", name: "宿根木", yomi: "しゅくねぎ", lat: 37.808, lng: 138.244, event: "shukunegi" },
  { id: 58, type: "rival",    lat: 37.81213, lng: 138.26575, next: 64 },

  // ---- 近道（59〜63） ----
  { id: 59, type: "happening", lat: 37.91083, lng: 138.32619 },
  { id: 60, type: "lucky",    lat: 37.89379, lng: 138.33018 },
  { id: 61, type: "rival",    lat: 37.87674, lng: 138.33417 },
  { id: 62, type: "quiz",     lat: 37.85995, lng: 138.33226 },
  { id: 63, type: "move",     lat: 37.8405, lng: 138.31302 },

  // ---- 合流：小木・東の海ぞい（64〜87） ----
  { id: 64, type: "place", name: "小木港", yomi: "おぎこう", lat: 37.81626, lng: 138.28223, event: "ogi", stop: true },
  { id: 65, type: "happening", lat: 37.82488, lng: 138.30009 },
  { id: 66, type: "quiz",     lat: 37.82558, lng: 138.32247 },
  { id: 67, type: "rival",    lat: 37.83125, lng: 138.3567 },
  { id: 68, type: "shop", name: "売店", lat: 37.84798, lng: 138.38505, stop: true },
  { id: 69, type: "quiz",     lat: 37.86785, lng: 138.40978 },
  { id: 70, type: "lucky",    lat: 37.88317, lng: 138.43951, event: "jijii" }, // 棚田じじい
  { id: 71, type: "happening", lat: 37.89726, lng: 138.46995 },
  { id: 72, type: "rival",    lat: 37.91964, lng: 138.49064 },
  { id: 73, type: "lucky",    lat: 37.93224, lng: 138.50165 },
  { id: 74, type: "place", name: "岩首昇竜棚田", yomi: "いわくびしょうりゅうたなだ", lat: 37.94227, lng: 138.49157, event: "iwakubi", stop: true },
  { id: 75, type: "happening", lat: 37.95311, lng: 138.50946 },
  { id: 76, type: "move",     lat: 37.9724, lng: 138.51943 },
  { id: 77, type: "rival",    lat: 37.98609, lng: 138.52835 },
  { id: 78, type: "quiz",     lat: 37.99993, lng: 138.53811 },
  { id: 79, type: "lucky",    lat: 38.01383, lng: 138.54905 },
  { id: 80, type: "rival",    lat: 38.0303, lng: 138.55314 },
  { id: 81, type: "quiz",     lat: 38.0601, lng: 138.57067 },
  { id: 82, type: "lucky",    lat: 38.08128, lng: 138.55748 }, // 姫崎
  { id: 83, type: "shop", name: "売店", lat: 38.07898, lng: 138.53843, stop: true },
  { id: 84, type: "rival",    lat: 38.07207, lng: 138.52238 },
  { id: 85, type: "happening", lat: 38.06731, lng: 138.50204 },
  { id: 86, type: "move",     lat: 38.06061, lng: 138.48274, event: "kaeritakunai" }, // 帰りたくない
  { id: 87, type: "lucky",    lat: 38.06987, lng: 138.45574 }
];
