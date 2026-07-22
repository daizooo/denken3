// 自動生成: 三相交流(ac3)章の画像→問題マッピング（章フォルダ全画像のヘッダー実読で突合）。
// ドロップされたファイル名から紐付け先の問題(question_id)を引く。捨て問画像は含めない。
// 変則:
//  - 2問同居: なし（全画像とも1画像1問）。
//  - 解答またがり(0441+0442=問15, 0447+0448=問20, 0450+0451=問21, 0454+0455=問24):
//    いずれもB問題で見開き2画像構成。問題(sort 0)＋続き(sort 1)で同一 questionId に2枚。
//  - 捨て問(問9/17/25/26 = 0435/0444/0456/0457)はマッピングに含めない（MASTER未登録）。
//  - 0449 は連番の欠番（スキャン番号の飛び。問題の抜けではない）。
// short_answer_flag は全問 false（0428/0431/0437/0438/0440 のOCR候補5枚も画像目視で
//   左ページ全体が問題・右ページが解答の標準レイアウト、解答の左下食い込みなしと確認）。
//   よって answerYPct は全問 既定(100)。
import type { AssetMap } from '../lib/assets'

export const AC3_ASSETS: AssetMap = {
  'newIMG_0427.png': [{ questionId: 'ac3_1', region: null, sort: 0 }],
  'newIMG_0428.png': [{ questionId: 'ac3_2', region: null, sort: 0 }],
  'newIMG_0429.png': [{ questionId: 'ac3_3', region: null, sort: 0 }],
  'newIMG_0430.png': [{ questionId: 'ac3_4', region: null, sort: 0 }],
  'newIMG_0431.png': [{ questionId: 'ac3_5', region: null, sort: 0 }],
  'newIMG_0432.png': [{ questionId: 'ac3_6', region: null, sort: 0 }],
  'newIMG_0433.png': [{ questionId: 'ac3_7', region: null, sort: 0 }],
  'newIMG_0434.png': [{ questionId: 'ac3_8', region: null, sort: 0 }],
  // 0435.png = 問9 捨て問（H28-B15・1線断線・対象外）
  'newIMG_0436.png': [{ questionId: 'ac3_10', region: null, sort: 0 }],
  'newIMG_0437.png': [{ questionId: 'ac3_11', region: null, sort: 0 }],
  'newIMG_0438.png': [{ questionId: 'ac3_12', region: null, sort: 0 }],
  'newIMG_0439.png': [{ questionId: 'ac3_13', region: null, sort: 0 }],
  'newIMG_0440.png': [{ questionId: 'ac3_14', region: null, sort: 0 }],
  // 解答またがり: 問15の問題文
  'newIMG_0441.png': [{ questionId: 'ac3_15', region: null, sort: 0 }],
  // 解答またがり: 問15の続き
  'newIMG_0442.png': [{ questionId: 'ac3_15', region: null, sort: 1 }],
  'newIMG_0443.png': [{ questionId: 'ac3_16', region: null, sort: 0 }],
  // 0444.png = 問17 捨て問（H23-B15・力率=1条件・対象外）
  'newIMG_0445.png': [{ questionId: 'ac3_18', region: null, sort: 0 }],
  'newIMG_0446.png': [{ questionId: 'ac3_19', region: null, sort: 0 }],
  // 解答またがり: 問20の問題文
  'newIMG_0447.png': [{ questionId: 'ac3_20', region: null, sort: 0 }],
  // 解答またがり: 問20の続き
  'newIMG_0448.png': [{ questionId: 'ac3_20', region: null, sort: 1 }],
  // 0449 欠番
  // 解答またがり: 問21の問題文
  'newIMG_0450.png': [{ questionId: 'ac3_21', region: null, sort: 0 }],
  // 解答またがり: 問21の続き
  'newIMG_0451.png': [{ questionId: 'ac3_21', region: null, sort: 1 }],
  'newIMG_0452.png': [{ questionId: 'ac3_22', region: null, sort: 0 }],
  'newIMG_0453.png': [{ questionId: 'ac3_23', region: null, sort: 0 }],
  // 解答またがり: 問24の問題文
  'newIMG_0454.png': [{ questionId: 'ac3_24', region: null, sort: 0 }],
  // 解答またがり: 問24の解答の続き
  'newIMG_0455.png': [{ questionId: 'ac3_24', region: null, sort: 1 }],
  // 0456.png = 問25 捨て問（H27-B17・V結線・対象外）
  // 0457.png = 問26 捨て問（H30-B15・電源直列・対象外）
}
