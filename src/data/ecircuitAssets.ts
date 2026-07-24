// 自動生成: 電子回路(ecircuit)章の画像→問題マッピング（章フォルダ全画像のヘッダー実読で突合）。
// ドロップされたファイル名から紐付け先の問題(question_id)を引く。捨て問・奥付画像は含めない。
// 全82画像(newIMG_0590〜0672、0632欠番=内容連続)を実読し MASTER(ECIRCUIT_QUESTIONS 52問)と突合。
// 変則:
//  - 2問同居: なし。
//  - 解答またがり: 長いB問題等で問題と解答が別画像に分かれるもの。同一 questionId に sort 0(問題)/1(解答続き)。
//      17問: 問9,10,11,12,17,18,19,23,26,32,33,45,50,53,55,56,57（各2画像）。
//  - 捨て問(問13,14,15,41,46,54)はマッピングに含めない（MASTER未登録）。いずれも各2画像で除外。
//  - 0672 は書籍奥付（問題ではない）ため対象外。
// short_answer 該当なし（全問 左ページ=問題・右ページ=解答の標準見開き）→ answerYPct は全問 既定(100)。
import type { AssetMap } from '../lib/assets'

export const ECIRCUIT_ASSETS: AssetMap = {
  'newIMG_0590.png': [{ questionId: 'ecircuit_1', region: null, sort: 0 }],
  'newIMG_0591.png': [{ questionId: 'ecircuit_2', region: null, sort: 0 }],
  'newIMG_0592.png': [{ questionId: 'ecircuit_3', region: null, sort: 0 }],
  'newIMG_0593.png': [{ questionId: 'ecircuit_4', region: null, sort: 0 }],
  'newIMG_0594.png': [{ questionId: 'ecircuit_5', region: null, sort: 0 }],
  'newIMG_0595.png': [{ questionId: 'ecircuit_6', region: null, sort: 0 }],
  'newIMG_0596.png': [{ questionId: 'ecircuit_7', region: null, sort: 0 }],
  'newIMG_0597.png': [{ questionId: 'ecircuit_8', region: null, sort: 0 }],
  // 解答またがり: 問9(0598+0599)
  'newIMG_0598.png': [{ questionId: 'ecircuit_9', region: null, sort: 0 }],
  'newIMG_0599.png': [{ questionId: 'ecircuit_9', region: null, sort: 1 }],
  // 解答またがり: 問10(0600+0601)
  'newIMG_0600.png': [{ questionId: 'ecircuit_10', region: null, sort: 0 }],
  'newIMG_0601.png': [{ questionId: 'ecircuit_10', region: null, sort: 1 }],
  // 解答またがり: 問11(0602+0603)
  'newIMG_0602.png': [{ questionId: 'ecircuit_11', region: null, sort: 0 }],
  'newIMG_0603.png': [{ questionId: 'ecircuit_11', region: null, sort: 1 }],
  // 解答またがり: 問12(0604+0605)
  'newIMG_0604.png': [{ questionId: 'ecircuit_12', region: null, sort: 0 }],
  'newIMG_0605.png': [{ questionId: 'ecircuit_12', region: null, sort: 1 }],
  // 0606+0607 = 問13 捨て問（トランジスタ増幅回路 H21-B18）
  // 0608+0609 = 問14 捨て問（トランジスタ増幅回路 H23-B18）
  // 0610+0611 = 問15 捨て問（トランジスタ増幅回路 R4下-B18）
  'newIMG_0612.png': [{ questionId: 'ecircuit_16', region: null, sort: 0 }],
  // 解答またがり: 問17(0613+0614)
  'newIMG_0613.png': [{ questionId: 'ecircuit_17', region: null, sort: 0 }],
  'newIMG_0614.png': [{ questionId: 'ecircuit_17', region: null, sort: 1 }],
  // 解答またがり: 問18(0615+0616)
  'newIMG_0615.png': [{ questionId: 'ecircuit_18', region: null, sort: 0 }],
  'newIMG_0616.png': [{ questionId: 'ecircuit_18', region: null, sort: 1 }],
  // 解答またがり: 問19(0617+0618)
  'newIMG_0617.png': [{ questionId: 'ecircuit_19', region: null, sort: 0 }],
  'newIMG_0618.png': [{ questionId: 'ecircuit_19', region: null, sort: 1 }],
  'newIMG_0619.png': [{ questionId: 'ecircuit_20', region: null, sort: 0 }],
  'newIMG_0620.png': [{ questionId: 'ecircuit_21', region: null, sort: 0 }],
  'newIMG_0621.png': [{ questionId: 'ecircuit_22', region: null, sort: 0 }],
  // 解答またがり: 問23(0622+0623)
  'newIMG_0622.png': [{ questionId: 'ecircuit_23', region: null, sort: 0 }],
  'newIMG_0623.png': [{ questionId: 'ecircuit_23', region: null, sort: 1 }],
  'newIMG_0624.png': [{ questionId: 'ecircuit_24', region: null, sort: 0 }],
  'newIMG_0625.png': [{ questionId: 'ecircuit_25', region: null, sort: 0 }],
  // 解答またがり: 問26(0626+0627)
  'newIMG_0626.png': [{ questionId: 'ecircuit_26', region: null, sort: 0 }],
  'newIMG_0627.png': [{ questionId: 'ecircuit_26', region: null, sort: 1 }],
  'newIMG_0628.png': [{ questionId: 'ecircuit_27', region: null, sort: 0 }],
  'newIMG_0629.png': [{ questionId: 'ecircuit_28', region: null, sort: 0 }],
  'newIMG_0630.png': [{ questionId: 'ecircuit_29', region: null, sort: 0 }],
  'newIMG_0631.png': [{ questionId: 'ecircuit_30', region: null, sort: 0 }],
  // 0632 欠番（内容連続）
  'newIMG_0633.png': [{ questionId: 'ecircuit_31', region: null, sort: 0 }],
  // 解答またがり: 問32(0634+0635)
  'newIMG_0634.png': [{ questionId: 'ecircuit_32', region: null, sort: 0 }],
  'newIMG_0635.png': [{ questionId: 'ecircuit_32', region: null, sort: 1 }],
  // 解答またがり: 問33(0636+0637)
  'newIMG_0636.png': [{ questionId: 'ecircuit_33', region: null, sort: 0 }],
  'newIMG_0637.png': [{ questionId: 'ecircuit_33', region: null, sort: 1 }],
  'newIMG_0638.png': [{ questionId: 'ecircuit_34', region: null, sort: 0 }],
  'newIMG_0639.png': [{ questionId: 'ecircuit_35', region: null, sort: 0 }],
  'newIMG_0640.png': [{ questionId: 'ecircuit_36', region: null, sort: 0 }],
  'newIMG_0641.png': [{ questionId: 'ecircuit_37', region: null, sort: 0 }],
  'newIMG_0642.png': [{ questionId: 'ecircuit_38', region: null, sort: 0 }],
  'newIMG_0643.png': [{ questionId: 'ecircuit_39', region: null, sort: 0 }],
  'newIMG_0644.png': [{ questionId: 'ecircuit_40', region: null, sort: 0 }],
  // 0645+0646 = 問41 捨て問（演算増幅器 R4上-A13）
  'newIMG_0647.png': [{ questionId: 'ecircuit_42', region: null, sort: 0 }],
  'newIMG_0648.png': [{ questionId: 'ecircuit_43', region: null, sort: 0 }],
  'newIMG_0649.png': [{ questionId: 'ecircuit_44', region: null, sort: 0 }],
  // 解答またがり: 問45(0650+0651)
  'newIMG_0650.png': [{ questionId: 'ecircuit_45', region: null, sort: 0 }],
  'newIMG_0651.png': [{ questionId: 'ecircuit_45', region: null, sort: 1 }],
  // 0652+0653 = 問46 捨て問（演算増幅器/発振回路 H29-B18）
  'newIMG_0654.png': [{ questionId: 'ecircuit_47', region: null, sort: 0 }],
  'newIMG_0655.png': [{ questionId: 'ecircuit_48', region: null, sort: 0 }],
  'newIMG_0656.png': [{ questionId: 'ecircuit_49', region: null, sort: 0 }],
  // 解答またがり: 問50(0657+0658)
  'newIMG_0657.png': [{ questionId: 'ecircuit_50', region: null, sort: 0 }],
  'newIMG_0658.png': [{ questionId: 'ecircuit_50', region: null, sort: 1 }],
  'newIMG_0659.png': [{ questionId: 'ecircuit_51', region: null, sort: 0 }],
  'newIMG_0660.png': [{ questionId: 'ecircuit_52', region: null, sort: 0 }],
  // 解答またがり: 問53(0661+0662)
  'newIMG_0661.png': [{ questionId: 'ecircuit_53', region: null, sort: 0 }],
  'newIMG_0662.png': [{ questionId: 'ecircuit_53', region: null, sort: 1 }],
  // 0663+0664 = 問54 捨て問（パルス回路/集積回路 R1-B17）
  // 解答またがり: 問55(0665+0666)
  'newIMG_0665.png': [{ questionId: 'ecircuit_55', region: null, sort: 0 }],
  'newIMG_0666.png': [{ questionId: 'ecircuit_55', region: null, sort: 1 }],
  // 解答またがり: 問56(0667+0668)
  'newIMG_0667.png': [{ questionId: 'ecircuit_56', region: null, sort: 0 }],
  'newIMG_0668.png': [{ questionId: 'ecircuit_56', region: null, sort: 1 }],
  // 解答またがり: 問57(0669+0670)
  'newIMG_0669.png': [{ questionId: 'ecircuit_57', region: null, sort: 0 }],
  'newIMG_0670.png': [{ questionId: 'ecircuit_57', region: null, sort: 1 }],
  'newIMG_0671.png': [{ questionId: 'ecircuit_58', region: null, sort: 0 }],
  // 0672 は書籍奥付のため対象外
}
