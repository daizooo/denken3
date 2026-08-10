// 自動生成＋実画像視認: 三相交流(ac3)章の画像→問題マッピング。
// ドロップされたファイル名から紐付け先の問題(question_id)を引く。捨て問画像は含めない。
// 変則:
//  - 2問同居: なし（全画像とも1画像1問）。
//  - B問題2画像構成（問15/20/21/24）: いずれも配点の大きいB問題で見開き2枚に渡る。
//    実画像を確認したところ、従来の「問題(sort0)＋解答続き(sort1)」という一律の見立ては誤りで、
//    レイアウトは問題ごとに異なる。answerXPct で1枚ごとに正しくマスク位置を指定する:
//      * 問15/20/21: 小問(a)と(b)がそれぞれ別の見開きにあり、各見開きが
//        「左=問題／右=解答」の標準レイアウト。2枚とも answerXPct=50（右を解答マスク）。
//        ← 従来 sort1 を解答続き扱いにしていたため(b)の問題文が隠れていた不具合を是正。
//      * 問24: 1枚目(0454)が問題見開き丸ごと（左=問題文＋(a)(b)、右=図1・図2）で
//        answerXPct=100（マスクなし・全面問題）。2枚目(0455)が解答（左=解答／右=MEMO空白）で
//        answerXPct=0（見開き丸ごと解答＝「解答を見る」まで非表示）。
//        ← 従来1枚目の右半分（図1・図2）まで解答マスクで隠れていた不具合を是正。
//  - 捨て問(問9/17/25/26 = 0435/0444/0456/0457)はマッピングに含めない（MASTER未登録）。
//  - 0449 は連番の欠番（スキャン番号の飛び。問題の抜けではない）。
// answerYPct は全問 既定(100)（左下への解答食い込みなしと確認済み）。
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
  // 問15(B問題): (a)の見開き＝左問題／右解答
  'newIMG_0441.png': [{ questionId: 'ac3_15', region: null, sort: 0, answerXPct: 50 }],
  // 問15(B問題): (b)の見開き＝左問題／右解答（従来は解答続き扱いで(b)問題文が隠れていた）
  'newIMG_0442.png': [{ questionId: 'ac3_15', region: null, sort: 1, answerXPct: 50 }],
  'newIMG_0443.png': [{ questionId: 'ac3_16', region: null, sort: 0 }],
  // 0444.png = 問17 捨て問（H23-B15・力率=1条件・対象外）
  'newIMG_0445.png': [{ questionId: 'ac3_18', region: null, sort: 0 }],
  'newIMG_0446.png': [{ questionId: 'ac3_19', region: null, sort: 0 }],
  // 問20(B問題): (a)の見開き＝左問題／右解答
  'newIMG_0447.png': [{ questionId: 'ac3_20', region: null, sort: 0, answerXPct: 50 }],
  // 問20(B問題): (b)の見開き＝左問題／右解答（従来は解答続き扱いで(b)問題文が隠れていた）
  'newIMG_0448.png': [{ questionId: 'ac3_20', region: null, sort: 1, answerXPct: 50 }],
  // 0449 欠番
  // 問21(B問題): (a)の見開き＝左問題／右解答
  'newIMG_0450.png': [{ questionId: 'ac3_21', region: null, sort: 0, answerXPct: 50 }],
  // 問21(B問題): (b)の見開き＝左問題／右解答（従来は解答続き扱いで(b)問題文が隠れていた）
  'newIMG_0451.png': [{ questionId: 'ac3_21', region: null, sort: 1, answerXPct: 50 }],
  'newIMG_0452.png': [{ questionId: 'ac3_22', region: null, sort: 0 }],
  'newIMG_0453.png': [{ questionId: 'ac3_23', region: null, sort: 0 }],
  // 問24(B問題): 1枚目＝問題見開き丸ごと（左=問題文＋(a)(b)、右=図1・図2）→ マスクなし全面問題
  'newIMG_0454.png': [{ questionId: 'ac3_24', region: null, sort: 0, answerXPct: 100 }],
  // 問24(B問題): 2枚目＝解答（左=解答／右=MEMO空白）→ 見開き丸ごと解答（解答を見るまで非表示）
  'newIMG_0455.png': [{ questionId: 'ac3_24', region: null, sort: 1, answerXPct: 0 }],
  // 0456.png = 問25 捨て問（H27-B17・V結線・対象外）
  // 0457.png = 問26 捨て問（H30-B15・電源直列・対象外）
}
