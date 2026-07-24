// 自動生成: 電子理論(etheory)章の画像→問題マッピング（章フォルダ全画像のヘッダー実読で突合）。
// ドロップされたファイル名から紐付け先の問題(question_id)を引く。捨て問画像は含めない。
// 全50画像(newIMG_0538〜0589、0552/0572欠番=内容連続)を実読し MASTER(ETHEORY_QUESTIONS 42問)と突合。
// 変則:
//  - 2問同居: なし。
//  - 解答またがり: 長い問題で問題と解答が別画像に分かれるもの。同一 questionId に sort 0(問題)/1(解答続き)。
//      問13(0550+0551)・問35(0575+0576)・問40(0581+0582)・問46(0588+0589)。
//  - 捨て問(問5,9,20,45)はマッピングに含めない（MASTER未登録）。いずれも各1画像で除外。
// short_answer 該当なし（全問 左ページ=問題・右ページ=解答の標準見開き）→ answerYPct は全問 既定(100)。
import type { AssetMap } from '../lib/assets'

export const ETHEORY_ASSETS: AssetMap = {
  'newIMG_0538.png': [{ questionId: 'etheory_1', region: null, sort: 0 }],
  'newIMG_0539.png': [{ questionId: 'etheory_2', region: null, sort: 0 }],
  'newIMG_0540.png': [{ questionId: 'etheory_3', region: null, sort: 0 }],
  'newIMG_0541.png': [{ questionId: 'etheory_4', region: null, sort: 0 }],
  // 0542 = 問5 捨て問（電界中の電子 H27-A12・1画像）
  'newIMG_0543.png': [{ questionId: 'etheory_6', region: null, sort: 0 }],
  'newIMG_0544.png': [{ questionId: 'etheory_7', region: null, sort: 0 }],
  'newIMG_0545.png': [{ questionId: 'etheory_8', region: null, sort: 0 }],
  // 0546 = 問9 捨て問（電界中の電子/磁界中の電子 R6下-A12・1画像）
  'newIMG_0547.png': [{ questionId: 'etheory_10', region: null, sort: 0 }],
  'newIMG_0548.png': [{ questionId: 'etheory_11', region: null, sort: 0 }],
  'newIMG_0549.png': [{ questionId: 'etheory_12', region: null, sort: 0 }],
  // 解答またがり: 問13(問題=0550 / 解答=0551)
  'newIMG_0550.png': [{ questionId: 'etheory_13', region: null, sort: 0 }],
  'newIMG_0551.png': [{ questionId: 'etheory_13', region: null, sort: 1 }],
  'newIMG_0553.png': [{ questionId: 'etheory_14', region: null, sort: 0 }],
  'newIMG_0554.png': [{ questionId: 'etheory_15', region: null, sort: 0 }],
  'newIMG_0555.png': [{ questionId: 'etheory_16', region: null, sort: 0 }],
  'newIMG_0556.png': [{ questionId: 'etheory_17', region: null, sort: 0 }],
  'newIMG_0557.png': [{ questionId: 'etheory_18', region: null, sort: 0 }],
  'newIMG_0558.png': [{ questionId: 'etheory_19', region: null, sort: 0 }],
  // 0559 = 問20 捨て問（紫外線ランプ H29-A12・1画像）
  'newIMG_0560.png': [{ questionId: 'etheory_21', region: null, sort: 0 }],
  'newIMG_0561.png': [{ questionId: 'etheory_22', region: null, sort: 0 }],
  'newIMG_0562.png': [{ questionId: 'etheory_23', region: null, sort: 0 }],
  'newIMG_0563.png': [{ questionId: 'etheory_24', region: null, sort: 0 }],
  'newIMG_0564.png': [{ questionId: 'etheory_25', region: null, sort: 0 }],
  'newIMG_0565.png': [{ questionId: 'etheory_26', region: null, sort: 0 }],
  'newIMG_0566.png': [{ questionId: 'etheory_27', region: null, sort: 0 }],
  'newIMG_0567.png': [{ questionId: 'etheory_28', region: null, sort: 0 }],
  'newIMG_0568.png': [{ questionId: 'etheory_29', region: null, sort: 0 }],
  'newIMG_0569.png': [{ questionId: 'etheory_30', region: null, sort: 0 }],
  'newIMG_0570.png': [{ questionId: 'etheory_31', region: null, sort: 0 }],
  'newIMG_0571.png': [{ questionId: 'etheory_32', region: null, sort: 0 }],
  'newIMG_0573.png': [{ questionId: 'etheory_33', region: null, sort: 0 }],
  'newIMG_0574.png': [{ questionId: 'etheory_34', region: null, sort: 0 }],
  // 解答またがり: 問35(問題=0575 / 解答=0576)
  'newIMG_0575.png': [{ questionId: 'etheory_35', region: null, sort: 0 }],
  'newIMG_0576.png': [{ questionId: 'etheory_35', region: null, sort: 1 }],
  'newIMG_0577.png': [{ questionId: 'etheory_36', region: null, sort: 0 }],
  'newIMG_0578.png': [{ questionId: 'etheory_37', region: null, sort: 0 }],
  'newIMG_0579.png': [{ questionId: 'etheory_38', region: null, sort: 0 }],
  'newIMG_0580.png': [{ questionId: 'etheory_39', region: null, sort: 0 }],
  // 解答またがり: 問40(問題=0581 / 解答=0582)
  'newIMG_0581.png': [{ questionId: 'etheory_40', region: null, sort: 0 }],
  'newIMG_0582.png': [{ questionId: 'etheory_40', region: null, sort: 1 }],
  'newIMG_0583.png': [{ questionId: 'etheory_41', region: null, sort: 0 }],
  'newIMG_0584.png': [{ questionId: 'etheory_42', region: null, sort: 0 }],
  'newIMG_0585.png': [{ questionId: 'etheory_43', region: null, sort: 0 }],
  'newIMG_0586.png': [{ questionId: 'etheory_44', region: null, sort: 0 }],
  // 0587 = 問45 捨て問（ダイオード H27-A11・1画像）
  // 解答またがり: 問46(問題=0588 / 解答=0589)
  'newIMG_0588.png': [{ questionId: 'etheory_46', region: null, sort: 0 }],
  'newIMG_0589.png': [{ questionId: 'etheory_46', region: null, sort: 1 }],
}
