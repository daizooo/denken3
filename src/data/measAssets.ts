// 自動生成: 電気計測(meas)章の画像→問題マッピング（章フォルダ全画像のヘッダー実読で突合）。
// ドロップされたファイル名から紐付け先の問題(question_id)を引く。捨て問画像は含めない。
// 全59画像(newIMG_0478〜0537、0517欠番=内容連続)を実読し MASTER(MEAS_QUESTIONS 42問)と突合。
// 変則:
//  - 2問同居(0511): 1画像に問31(上)＋問32(下)。上バンド=小番号(region 'top')/下バンド=大番号(region 'bottom')。
//  - 解答またがり: 長いB問題で問題と解答が別画像に分かれるもの。同一 questionId に sort 0(問題)/1..(解答続き)。
//      問28(0507+0508)・問34(0513+0514)・問45(0526+0527)・問46(0528+0529+0530、3画像)。
//  - 捨て問(問2,22,29,39,44,48,49,50,51)はマッピングに含めない（MASTER未登録）。
//      2問(0479+0480)・22問(0500+0501)・48問(0532+0533)・51問(0536+0537)は各2画像、29/39/44/49/50問は各1画像で除外。
// short_answer 該当なし（全問 左ページ=問題・右ページ=解答の標準見開き、または上下2問同居）。
//   よって answerYPct は全問 既定(100)。
import type { AssetMap } from '../lib/assets'

export const MEAS_ASSETS: AssetMap = {
  'newIMG_0478.png': [{ questionId: 'meas_1', region: null, sort: 0 }],
  // 0479+0480 = 問2 捨て問（測定法/ブリッジ回路 H21-B15・見開き2画像）
  'newIMG_0481.png': [{ questionId: 'meas_3', region: null, sort: 0 }],
  'newIMG_0482.png': [{ questionId: 'meas_4', region: null, sort: 0 }],
  'newIMG_0483.png': [{ questionId: 'meas_5', region: null, sort: 0 }],
  'newIMG_0484.png': [{ questionId: 'meas_6', region: null, sort: 0 }],
  'newIMG_0485.png': [{ questionId: 'meas_7', region: null, sort: 0 }],
  'newIMG_0486.png': [{ questionId: 'meas_8', region: null, sort: 0 }],
  'newIMG_0487.png': [{ questionId: 'meas_9', region: null, sort: 0 }],
  'newIMG_0488.png': [{ questionId: 'meas_10', region: null, sort: 0 }],
  'newIMG_0489.png': [{ questionId: 'meas_11', region: null, sort: 0 }],
  'newIMG_0490.png': [{ questionId: 'meas_12', region: null, sort: 0 }],
  'newIMG_0491.png': [{ questionId: 'meas_13', region: null, sort: 0 }],
  'newIMG_0492.png': [{ questionId: 'meas_14', region: null, sort: 0 }],
  'newIMG_0493.png': [{ questionId: 'meas_15', region: null, sort: 0 }],
  'newIMG_0494.png': [{ questionId: 'meas_16', region: null, sort: 0 }],
  'newIMG_0495.png': [{ questionId: 'meas_17', region: null, sort: 0 }],
  'newIMG_0496.png': [{ questionId: 'meas_18', region: null, sort: 0 }],
  'newIMG_0497.png': [{ questionId: 'meas_19', region: null, sort: 0 }],
  'newIMG_0498.png': [{ questionId: 'meas_20', region: null, sort: 0 }],
  'newIMG_0499.png': [{ questionId: 'meas_21', region: null, sort: 0 }],
  // 0500+0501 = 問22 捨て問（電圧計/ディジタル計器 R1-B18・見開き2画像）
  'newIMG_0502.png': [{ questionId: 'meas_23', region: null, sort: 0 }],
  'newIMG_0503.png': [{ questionId: 'meas_24', region: null, sort: 0 }],
  'newIMG_0504.png': [{ questionId: 'meas_25', region: null, sort: 0 }],
  'newIMG_0505.png': [{ questionId: 'meas_26', region: null, sort: 0 }],
  'newIMG_0506.png': [{ questionId: 'meas_27', region: null, sort: 0 }],
  // 解答またがり: 問28(a=0507 / b=0508)
  'newIMG_0507.png': [{ questionId: 'meas_28', region: null, sort: 0 }],
  'newIMG_0508.png': [{ questionId: 'meas_28', region: null, sort: 1 }],
  // 0509 = 問29 捨て問（指示電気計器/電圧計/電流計 R7-B16・1画像）
  'newIMG_0510.png': [{ questionId: 'meas_30', region: null, sort: 0 }],
  // 2問同居: 問31(上)＋問32(下)
  'newIMG_0511.png': [{ questionId: 'meas_31', region: 'top', sort: 0 }, { questionId: 'meas_32', region: 'bottom', sort: 0 }],
  'newIMG_0512.png': [{ questionId: 'meas_33', region: null, sort: 0 }],
  // 解答またがり: 問34(問題=0513 / 解答=0514)
  'newIMG_0513.png': [{ questionId: 'meas_34', region: null, sort: 0 }],
  'newIMG_0514.png': [{ questionId: 'meas_34', region: null, sort: 1 }],
  'newIMG_0515.png': [{ questionId: 'meas_35', region: null, sort: 0 }],
  'newIMG_0516.png': [{ questionId: 'meas_36', region: null, sort: 0 }],
  'newIMG_0518.png': [{ questionId: 'meas_37', region: null, sort: 0 }],
  'newIMG_0519.png': [{ questionId: 'meas_38', region: null, sort: 0 }],
  // 0520 = 問39 捨て問（電力量計 H7-A10・1画像）
  'newIMG_0521.png': [{ questionId: 'meas_40', region: null, sort: 0 }],
  'newIMG_0522.png': [{ questionId: 'meas_41', region: null, sort: 0 }],
  'newIMG_0523.png': [{ questionId: 'meas_42', region: null, sort: 0 }],
  'newIMG_0524.png': [{ questionId: 'meas_43', region: null, sort: 0 }],
  // 0525 = 問44 捨て問（指示電気計器/電力計 H18-A14・1画像）
  // 解答またがり: 問45(問題=0526 / 解答=0527)
  'newIMG_0526.png': [{ questionId: 'meas_45', region: null, sort: 0 }],
  'newIMG_0527.png': [{ questionId: 'meas_45', region: null, sort: 1 }],
  // 解答またがり: 問46(0528+0529+0530の3画像)
  'newIMG_0528.png': [{ questionId: 'meas_46', region: null, sort: 0 }],
  'newIMG_0529.png': [{ questionId: 'meas_46', region: null, sort: 1 }],
  'newIMG_0530.png': [{ questionId: 'meas_46', region: null, sort: 2 }],
  'newIMG_0531.png': [{ questionId: 'meas_47', region: null, sort: 0 }],
  // 0532+0533 = 問48 捨て問（電位差計 H16-B17/R4上-B16・見開き2画像）
  // 0534 = 問49 捨て問（オシロスコープ H12-A8・1画像）
  // 0535 = 問50 捨て問（オシロスコープ H25-B16・1画像）
  // 0536+0537 = 問51 捨て問（オシロスコープ H20-B16・見開き2画像）
}
