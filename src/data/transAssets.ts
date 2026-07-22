// 自動生成: 過渡現象(trans)章の画像→問題マッピング（章フォルダ全画像のヘッダー実読で突合）。
// ドロップされたファイル名から紐付け先の問題(question_id)を引く。捨て問画像は含めない。
// 変則:
//  - 2問同居(0461): 1画像に2問。上バンド=問4(region 'top')/下バンド=問5(region 'bottom')。
//  - 解答またがり(0466+0467=問10, 0468+0469=問11): 問題(sort 0)と解答の続き(sort 1)で画像2枚。
//  - 捨て問(問12/16/17/18/19 = 0470/0474/0475/0476/0477)はマッピングに含めない（MASTER未登録）。
// short_answer_flag は全問 false（0460/0461/0462 の候補も画像目視で解答は右ページ内に収まり左下食い込みなしと確認）。
//   よって answerYPct は全問 既定(100)。
import type { AssetMap } from '../lib/assets'

export const TRANS_ASSETS: AssetMap = {
  'newIMG_0458.png': [{ questionId: 'trans_1', region: null, sort: 0 }],
  'newIMG_0459.png': [{ questionId: 'trans_2', region: null, sort: 0 }],
  'newIMG_0460.png': [{ questionId: 'trans_3', region: null, sort: 0 }],
  // 2問同居: 問4(上)＋問5(下)
  'newIMG_0461.png': [{ questionId: 'trans_4', region: 'top', sort: 0 }, { questionId: 'trans_5', region: 'bottom', sort: 0 }],
  'newIMG_0462.png': [{ questionId: 'trans_6', region: null, sort: 0 }],
  'newIMG_0463.png': [{ questionId: 'trans_7', region: null, sort: 0 }],
  'newIMG_0464.png': [{ questionId: 'trans_8', region: null, sort: 0 }],
  'newIMG_0465.png': [{ questionId: 'trans_9', region: null, sort: 0 }],
  // 解答またがり: 問10の問題文
  'newIMG_0466.png': [{ questionId: 'trans_10', region: null, sort: 0 }],
  // 解答またがり: 問10の解答の続き
  'newIMG_0467.png': [{ questionId: 'trans_10', region: null, sort: 1 }],
  // 解答またがり: 問11の問題文
  'newIMG_0468.png': [{ questionId: 'trans_11', region: null, sort: 0 }],
  // 解答またがり: 問11の解答の続き
  'newIMG_0469.png': [{ questionId: 'trans_11', region: null, sort: 1 }],
  // 0470.png = 問12 捨て問（H25-A12・対象外）
  'newIMG_0471.png': [{ questionId: 'trans_13', region: null, sort: 0 }],
  'newIMG_0472.png': [{ questionId: 'trans_14', region: null, sort: 0 }],
  'newIMG_0473.png': [{ questionId: 'trans_15', region: null, sort: 0 }],
  // 0474.png = 問16 捨て問（R4下-A10・対象外）
  // 0475.png = 問17 捨て問（R6-A10・対象外）
  // 0476.png = 問18 捨て問（R2-A10・対象外）
  // 0477.png = 問19 捨て問（H23-B16・対象外）
}
