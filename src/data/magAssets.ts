// 自動生成: 電磁気(mag)章の画像→問題マッピング（章フォルダ全画像のヘッダー実読で突合）。
// ドロップされたファイル名から紐付け先の問題(question_id)を引く。捨て問画像は含めない。
// 変則:
//  - 2問同居(0245,0264): 1画像に2問。上バンド=小番号(region 'top')/下バンド=大番号(region 'bottom')。
//  - 解答またがり(0276+0277=問51): 問題(sort 0)＋解答の続き(sort 1)で同一 questionId に2枚。
//  - 捨て問(問30 = 0255+0256)はマッピングに含めない（MASTER未登録）。
//    ※問30は見開き2画像(問題0255＋解答0256)構成のため2枚とも除外。
// short_answer_flag は全問 false（0236/0237/0249/0252/0265 のOCR候補5枚も画像目視で
//   左ページ全体が問題・右ページが解答の標準レイアウト、解答の左下食い込みなしと確認）。
//   よって answerYPct は全問 既定(100)。
import type { AssetMap } from '../lib/assets'

export const MAG_ASSETS: AssetMap = {
  'newIMG_0227.png': [{ questionId: 'mag_1', region: null, sort: 0 }],
  'newIMG_0228.png': [{ questionId: 'mag_2', region: null, sort: 0 }],
  'newIMG_0229.png': [{ questionId: 'mag_3', region: null, sort: 0 }],
  'newIMG_0230.png': [{ questionId: 'mag_4', region: null, sort: 0 }],
  'newIMG_0231.png': [{ questionId: 'mag_5', region: null, sort: 0 }],
  'newIMG_0232.png': [{ questionId: 'mag_6', region: null, sort: 0 }],
  'newIMG_0233.png': [{ questionId: 'mag_7', region: null, sort: 0 }],
  'newIMG_0234.png': [{ questionId: 'mag_8', region: null, sort: 0 }],
  'newIMG_0235.png': [{ questionId: 'mag_9', region: null, sort: 0 }],
  'newIMG_0236.png': [{ questionId: 'mag_10', region: null, sort: 0 }],
  'newIMG_0237.png': [{ questionId: 'mag_11', region: null, sort: 0 }],
  'newIMG_0238.png': [{ questionId: 'mag_12', region: null, sort: 0 }],
  'newIMG_0239.png': [{ questionId: 'mag_13', region: null, sort: 0 }],
  'newIMG_0240.png': [{ questionId: 'mag_14', region: null, sort: 0 }],
  'newIMG_0241.png': [{ questionId: 'mag_15', region: null, sort: 0 }],
  'newIMG_0242.png': [{ questionId: 'mag_16', region: null, sort: 0 }],
  'newIMG_0243.png': [{ questionId: 'mag_17', region: null, sort: 0 }],
  'newIMG_0244.png': [{ questionId: 'mag_18', region: null, sort: 0 }],
  // 2問同居: 問19(上)＋問20(下)
  'newIMG_0245.png': [{ questionId: 'mag_19', region: 'top', sort: 0 }, { questionId: 'mag_20', region: 'bottom', sort: 0 }],
  'newIMG_0246.png': [{ questionId: 'mag_21', region: null, sort: 0 }],
  'newIMG_0247.png': [{ questionId: 'mag_22', region: null, sort: 0 }],
  'newIMG_0248.png': [{ questionId: 'mag_23', region: null, sort: 0 }],
  'newIMG_0249.png': [{ questionId: 'mag_24', region: null, sort: 0 }],
  'newIMG_0250.png': [{ questionId: 'mag_25', region: null, sort: 0 }],
  'newIMG_0251.png': [{ questionId: 'mag_26', region: null, sort: 0 }],
  'newIMG_0252.png': [{ questionId: 'mag_27', region: null, sort: 0 }],
  'newIMG_0253.png': [{ questionId: 'mag_28', region: null, sort: 0 }],
  'newIMG_0254.png': [{ questionId: 'mag_29', region: null, sort: 0 }],
  // 0255.png+0256.png = 問30 捨て問（H27-A5・誘導起電力・対象外／見開き2画像）
  'newIMG_0257.png': [{ questionId: 'mag_31', region: null, sort: 0 }],
  'newIMG_0258.png': [{ questionId: 'mag_32', region: null, sort: 0 }],
  'newIMG_0259.png': [{ questionId: 'mag_33', region: null, sort: 0 }],
  'newIMG_0260.png': [{ questionId: 'mag_34', region: null, sort: 0 }],
  'newIMG_0261.png': [{ questionId: 'mag_35', region: null, sort: 0 }],
  'newIMG_0262.png': [{ questionId: 'mag_36', region: null, sort: 0 }],
  'newIMG_0263.png': [{ questionId: 'mag_37', region: null, sort: 0 }],
  // 2問同居: 問38(上)＋問39(下)
  'newIMG_0264.png': [{ questionId: 'mag_38', region: 'top', sort: 0 }, { questionId: 'mag_39', region: 'bottom', sort: 0 }],
  'newIMG_0265.png': [{ questionId: 'mag_40', region: null, sort: 0 }],
  'newIMG_0266.png': [{ questionId: 'mag_41', region: null, sort: 0 }],
  'newIMG_0267.png': [{ questionId: 'mag_42', region: null, sort: 0 }],
  'newIMG_0268.png': [{ questionId: 'mag_43', region: null, sort: 0 }],
  'newIMG_0269.png': [{ questionId: 'mag_44', region: null, sort: 0 }],
  'newIMG_0270.png': [{ questionId: 'mag_45', region: null, sort: 0 }],
  'newIMG_0271.png': [{ questionId: 'mag_46', region: null, sort: 0 }],
  'newIMG_0272.png': [{ questionId: 'mag_47', region: null, sort: 0 }],
  'newIMG_0273.png': [{ questionId: 'mag_48', region: null, sort: 0 }],
  'newIMG_0274.png': [{ questionId: 'mag_49', region: null, sort: 0 }],
  'newIMG_0275.png': [{ questionId: 'mag_50', region: null, sort: 0 }],
  // 解答またがり: 問51の問題文
  'newIMG_0276.png': [{ questionId: 'mag_51', region: null, sort: 0 }],
  // 解答またがり: 問51の解答の続き
  'newIMG_0277.png': [{ questionId: 'mag_51', region: null, sort: 1 }],
  'newIMG_0278.png': [{ questionId: 'mag_52', region: null, sort: 0 }],
  'newIMG_0279.png': [{ questionId: 'mag_53', region: null, sort: 0 }],
  'newIMG_0280.png': [{ questionId: 'mag_54', region: null, sort: 0 }],
  'newIMG_0281.png': [{ questionId: 'mag_55', region: null, sort: 0 }],
  'newIMG_0282.png': [{ questionId: 'mag_56', region: null, sort: 0 }],
}
