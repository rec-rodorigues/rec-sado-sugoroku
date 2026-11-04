// =====================================================
// ハードモードのイベント・カード
// =====================================================
// ハードモードでは、data/events.js（イージーモード）ではなく、ここに書いたものだけを使う。
// 文章は ふつうの漢字・かな まじりで書く（分かち書き・ふりがな なし）。
// 書き方・ポイントの幅は data/events.js と同じ。
//
// ハードモードだけで使える effect：
//   effect: "twoDice" … 次の番はサイコロを2個振って、好きな方を選べる
//   effect: "card"    … カードを1枚引く

window.ADULT_EVENTS = {

  // ---------- 名所マス ----------
  places: [
    { id: "toki", title: "トキの森公園を訪れた", text: "保護・繁殖されているトキを間近で観察できる。",
      photo: "", point: 70 }, // 使用の許可を確認中：images/places/toki.webp
    { id: "onogame", title: "大野亀に到着", text: "海に突き出た巨大な一枚岩。初夏にはトビシマカンゾウが一面に咲く。",
      photo: "images/places/onogame.webp", point: 60 },
    { id: "kinzan", title: "金を掘り当てた！", text: "サイコロを振って、出た目×30点分の金を掘り出そう。",
      photo: "images/places/kinzan.webp", dice: 30 },
    { id: "daizen", title: "能を鑑賞した", text: "大膳神社の能舞台で、古くから続く能を観た。",
      photo: "images/places/daizen.png", point: 80 },
    { id: "benkei", title: "地魚の寿司を味わった", text: "佐渡の海で獲れた魚の寿司は格別。",
      photo: "images/places/benkei.webp", point: 70 },
    { id: "myosenji", title: "五重塔を見上げた", text: "妙宣寺の五重塔は、新潟県内で唯一の五重塔。",
      photo: "images/places/myosenji.webp", point: 60 },
    { id: "ogi", title: "たらい舟に乗った", text: "丸いたらいの舟で、小木の海へ漕ぎ出した。",
      photo: "images/places/ogi.png", point: 50 },
    { id: "iwakubi", title: "棚田で新米を収穫", text: "山の斜面に広がる岩首昇竜棚田。穫れたての米は絶品。",
      photo: "images/places/iwakubi.webp", point: 50 },
    { id: "futatsugame", title: "二ツ亀を眺めた", text: "2匹の亀のような島。干潮時には砂浜を歩いて渡れる。",
      photo: "", point: 60 },
    { id: "senkaku", title: "尖閣湾を遊覧船で巡った", text: "断崖が続く入り江。映画「君の名は」のロケ地としても知られる。",
      photo: "", point: 60 },
    { id: "hakuuntai", title: "白雲台から島を見渡した", text: "大佐渡スカイラインの途中にある展望台。国仲平野と真野湾が一望できる。",
      photo: "", point: 40 },
    { id: "bugyosho", title: "佐渡奉行所を見学した", text: "江戸時代に佐渡を治め、金山を管理した役所。建物が復元されている。",
      photo: "", point: 50 },
    { id: "shukunegi", title: "宿根木の町並みを歩いた", text: "船大工の町。狭い路地に家が並び、三角形の「三角家」もある。",
      photo: "", point: 60 }
  ],

  // ---------- ラッキーマス ----------
  lucky: [
    { title: "ぶりカツ丼を食べた", text: "佐渡産の寒ブリを揚げた名物丼。", point: 30 },
    { title: "温泉でリフレッシュ", text: "旅の疲れが取れた。", point: 20 },
    { title: "満天の星空", text: "サイコロで1か6が出たら、流れ星が見られるかも。", point: 30,
      bonus: { dice: [1, 6], title: "流れ星を見た！", point: 50 } },
    { title: "北沢浮遊選鉱場跡を訪れた", text: "鉱石から金銀を取り出した巨大な工場の跡。", point: 20, near: "kinzan" },
    { title: "海辺でバーベキュー", text: "仲間と食べる海の幸は最高。", point: 30 },
    { title: "透き通った海に心が洗われた", text: "佐渡の海は驚くほど青い。", point: 10, where: "coast" },
    { title: "シュノーケリングで大物に遭遇", text: "すぐ近くを大きな魚が泳いでいった。", point: 20, where: "coast" },
    { title: "イカ釣りで大漁", text: "佐渡のイカは鮮度抜群。", point: 20, where: "coast" },
    { title: "レンタカーを借りた", text: "次の番はサイコロを2個振って、好きな目を選べる。", point: 10, effect: "twoDice" },
    { title: "酒蔵を見学した", text: "佐渡の米と水で造る地酒。お土産も買えた。", point: 20 },
    { title: "地元の人にお土産をもらった", text: "カードを1枚引ける。", point: 10, effect: "card" },
    { title: "観光案内所で情報収集", text: "カードを1枚引ける。", point: 10, effect: "card" }
  ],

  // ---------- ハプニングマス ----------
  happening: [
    { title: "ビーチクリーンで疲れ果てた", text: "でも、海はきれいになった。", point: -20, where: "coast" },
    { title: "船酔いでダウン", text: "次の番は、進むマスが1つ減る。", point: 0, effect: "seasick" },
    { title: "雨で道がぬかるんだ", text: "靴が泥だらけに…", point: -10 },
    { title: "カラスに弁当を取られた", text: "ちょっと目を離した隙に…", point: -20 },
    { title: "転んで擦りむいた", text: "絆創膏を貼ってひと休み。", point: -10 },
    { title: "レンタサイクルがパンクした", text: "押して歩くことに…", point: -10 }
  ],

  // ---------- すすむ・もどるマス ----------
  move: [
    { title: "追い風に乗った", text: "自転車がすいすい進む。", steps: 2 },
    { title: "近道を見つけた", text: "地元の人が教えてくれた。", steps: 3 },
    { title: "道に迷った", text: "地図を見て引き返そう。", steps: -1 },
    { title: "忘れ物に気づいた", text: "帽子を取りに戻ろう。", steps: -2 }
  ],

  // ---------- 決まったマスのイベント ----------
  fixed: [
    { id: "jijii", title: "棚田じじいに会った", text: "棚田のことをいろいろ教えてくれた。", point: 80 },
    { id: "kaeritakunai", title: "帰りたくない…！", text: "佐渡が楽しすぎて、もう少しいたい。", steps: -3 }
  ],

  // ---------- 野生のトキ ----------
  wildToki: { title: "野生のトキを見つけた！", text: "空を舞うトキに出会えるとは、とても幸運。",
    photo: "images/places/wild-toki.png", point: 150, chance: 0.05 },

  // ---------- カード（カードマスで1枚引く） ----------
  // kind は下の6種類から選ぶ（ほかの名前は使えない）
  //   twoDice … サイコロを2個振って、好きな目を使う
  //   boost   … 出た目に steps を足す（1〜3）
  //   double  … この番で止まったマスのプラスのポイントが2倍
  //   swap    … 好きな人と位置を入れ替える
  //   steal   … 好きな人から point 点もらう（10〜50）
  //   guard   … 持っているだけで、ハプニングか、ほかの人からの「入れ替え」「横取り」を1回防ぐ
  // count … 山札に何枚入れるか（1〜5）
  cards: [
    { kind: "twoDice", title: "サイコロ2個", text: "サイコロを2個振って、好きな目を使う", count: 4 },
    { kind: "boost", title: "追い風", text: "出た目に+2", steps: 2, count: 4 },
    { kind: "double", title: "ポイント2倍", text: "この番で止まったマスのプラスのポイントが2倍", count: 3 },
    { kind: "swap", title: "入れ替え", text: "好きな人と位置を入れ替える", count: 3 },
    { kind: "steal", title: "横取り", text: "好きな人から30点もらう", point: 30, count: 3 },
    { kind: "guard", title: "お守り", text: "ハプニングか、入れ替え・横取りを1回防ぐ（持っているだけで効く）", count: 3 }
  ],

  // ---------- かけひきマス ----------
  // kind は下の5種類から選ぶ
  //   swap   … 好きな人と位置を入れ替えられる（入れ替えなくてもよい）
  //   steal  … 好きな人から point 点もらう（10〜50）
  //   leader … 自分以外でいちばんポイントが多い人から point 点もらう（10〜30）
  //   share  … ほかの人全員に point 点ずつ配る（10〜30）
  //   duel   … 好きな人とサイコロ勝負。大きい目の人が相手から point 点もらう（10〜50）
  rival: [
    { kind: "swap", title: "入れ替えチャンス", text: "好きな人と位置を入れ替えられる。入れ替えなくてもいい。" },
    { kind: "steal", title: "横取り", text: "好きな人からポイントをもらおう。", point: 30 },
    { kind: "leader", title: "トップにごちそうしてもらった", text: "いちばんポイントが多い人からもらえる。", point: 20 },
    { kind: "share", title: "お土産を配った", text: "ほかの人全員にポイントを配る。", point: 10 },
    { kind: "duel", title: "サイコロ勝負！", text: "相手を選んで、サイコロを1回ずつ振る。大きい目の人の勝ち。", point: 30 }
  ]
};
