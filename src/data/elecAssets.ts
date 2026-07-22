// 自動生成: 静電気(elec)章の画像→問題マッピング（章フォルダ全画像のヘッダー実読で突合）。
// ドロップされたファイル名から紐付け先の問題(question_id)を引く。捨て問画像は含めない。
// 変則:
//  - 2問同居(0145,0150,0169,0181): 1画像に2問。上バンド=小番号(region 'top')/下バンド=大番号(region 'bottom')。
//  - 解答またがり(0155+0156=問13, 0188+0189=問45, 0192+0193=問48, 0194+0195=問49,
//    0214+0215=問68, 0218+0219=問71): 問題(sort 0)＋解答の続き(sort 1)で同一 questionId に2枚。
//  - 捨て問(問17/21/31/70 = 0160/0164/0173+0174/0217)はマッピングに含めない（MASTER未登録）。
//    ※問31は捨て問だが見開き2画像(0173+0174)構成のため2枚とも除外。
//  - 0187 は連番の欠番（スキャン番号の飛び。問題の抜けではない）。
// short_answer_flag は全問 false（0166/0167/0201 のOCR候補3枚も画像目視で
//   左ページ全体が問題・右ページが解答の標準レイアウト、解答の左下食い込みなしと確認）。
//   よって answerYPct は全問 既定(100)。
import type { AssetMap } from '../lib/assets'

export const ELEC_ASSETS: AssetMap = {
  // 2問同居: 問1(上)＋問2(下)
  'newIMG_0145.png': [{ questionId: 'elec_1', region: 'top', sort: 0 }, { questionId: 'elec_2', region: 'bottom', sort: 0 }],
  'newIMG_0146.png': [{ questionId: 'elec_3', region: null, sort: 0 }],
  'newIMG_0147.png': [{ questionId: 'elec_4', region: null, sort: 0 }],
  'newIMG_0148.png': [{ questionId: 'elec_5', region: null, sort: 0 }],
  'newIMG_0149.png': [{ questionId: 'elec_6', region: null, sort: 0 }],
  // 2問同居: 問7(上)＋問8(下)
  'newIMG_0150.png': [{ questionId: 'elec_7', region: 'top', sort: 0 }, { questionId: 'elec_8', region: 'bottom', sort: 0 }],
  'newIMG_0151.png': [{ questionId: 'elec_9', region: null, sort: 0 }],
  'newIMG_0152.png': [{ questionId: 'elec_10', region: null, sort: 0 }],
  'newIMG_0153.png': [{ questionId: 'elec_11', region: null, sort: 0 }],
  'newIMG_0154.png': [{ questionId: 'elec_12', region: null, sort: 0 }],
  // 解答またがり: 問13の問題文
  'newIMG_0155.png': [{ questionId: 'elec_13', region: null, sort: 0 }],
  // 解答またがり: 問13の解答の続き
  'newIMG_0156.png': [{ questionId: 'elec_13', region: null, sort: 1 }],
  'newIMG_0157.png': [{ questionId: 'elec_14', region: null, sort: 0 }],
  'newIMG_0158.png': [{ questionId: 'elec_15', region: null, sort: 0 }],
  'newIMG_0159.png': [{ questionId: 'elec_16', region: null, sort: 0 }],
  // 0160.png = 問17 捨て問（H26-B17・運動エネルギーと静電エネルギーの複合・対象外）
  'newIMG_0161.png': [{ questionId: 'elec_18', region: null, sort: 0 }],
  'newIMG_0162.png': [{ questionId: 'elec_19', region: null, sort: 0 }],
  'newIMG_0163.png': [{ questionId: 'elec_20', region: null, sort: 0 }],
  // 0164.png = 問21 捨て問（H28-A1・点電荷による電位・難問・対象外）
  'newIMG_0165.png': [{ questionId: 'elec_22', region: null, sort: 0 }],
  'newIMG_0166.png': [{ questionId: 'elec_23', region: null, sort: 0 }],
  'newIMG_0167.png': [{ questionId: 'elec_24', region: null, sort: 0 }],
  'newIMG_0168.png': [{ questionId: 'elec_25', region: null, sort: 0 }],
  // 2問同居: 問26(上)＋問27(下)
  'newIMG_0169.png': [{ questionId: 'elec_26', region: 'top', sort: 0 }, { questionId: 'elec_27', region: 'bottom', sort: 0 }],
  'newIMG_0170.png': [{ questionId: 'elec_28', region: null, sort: 0 }],
  'newIMG_0171.png': [{ questionId: 'elec_29', region: null, sort: 0 }],
  'newIMG_0172.png': [{ questionId: 'elec_30', region: null, sort: 0 }],
  // 0173.png+0174.png = 問31 捨て問（R1-B15・電気力線・電位・静電エネルギーの複合・対象外／見開き2画像）
  'newIMG_0175.png': [{ questionId: 'elec_32', region: null, sort: 0 }],
  'newIMG_0176.png': [{ questionId: 'elec_33', region: null, sort: 0 }],
  'newIMG_0177.png': [{ questionId: 'elec_34', region: null, sort: 0 }],
  'newIMG_0178.png': [{ questionId: 'elec_35', region: null, sort: 0 }],
  'newIMG_0179.png': [{ questionId: 'elec_36', region: null, sort: 0 }],
  'newIMG_0180.png': [{ questionId: 'elec_37', region: null, sort: 0 }],
  // 2問同居: 問38(上)＋問39(下)
  'newIMG_0181.png': [{ questionId: 'elec_38', region: 'top', sort: 0 }, { questionId: 'elec_39', region: 'bottom', sort: 0 }],
  'newIMG_0182.png': [{ questionId: 'elec_40', region: null, sort: 0 }],
  'newIMG_0183.png': [{ questionId: 'elec_41', region: null, sort: 0 }],
  'newIMG_0184.png': [{ questionId: 'elec_42', region: null, sort: 0 }],
  'newIMG_0185.png': [{ questionId: 'elec_43', region: null, sort: 0 }],
  'newIMG_0186.png': [{ questionId: 'elec_44', region: null, sort: 0 }],
  // 0187 欠番
  // 解答またがり: 問45の問題文
  'newIMG_0188.png': [{ questionId: 'elec_45', region: null, sort: 0 }],
  // 解答またがり: 問45の解答の続き
  'newIMG_0189.png': [{ questionId: 'elec_45', region: null, sort: 1 }],
  'newIMG_0190.png': [{ questionId: 'elec_46', region: null, sort: 0 }],
  'newIMG_0191.png': [{ questionId: 'elec_47', region: null, sort: 0 }],
  // 解答またがり: 問48の問題文＋(a)解答
  'newIMG_0192.png': [{ questionId: 'elec_48', region: null, sort: 0 }],
  // 解答またがり: 問48の(b)の続き
  'newIMG_0193.png': [{ questionId: 'elec_48', region: null, sort: 1 }],
  // 解答またがり: 問49の問題文
  'newIMG_0194.png': [{ questionId: 'elec_49', region: null, sort: 0 }],
  // 解答またがり: 問49の解答の続き
  'newIMG_0195.png': [{ questionId: 'elec_49', region: null, sort: 1 }],
  'newIMG_0196.png': [{ questionId: 'elec_50', region: null, sort: 0 }],
  'newIMG_0197.png': [{ questionId: 'elec_51', region: null, sort: 0 }],
  'newIMG_0198.png': [{ questionId: 'elec_52', region: null, sort: 0 }],
  'newIMG_0199.png': [{ questionId: 'elec_53', region: null, sort: 0 }],
  'newIMG_0200.png': [{ questionId: 'elec_54', region: null, sort: 0 }],
  'newIMG_0201.png': [{ questionId: 'elec_55', region: null, sort: 0 }],
  'newIMG_0202.png': [{ questionId: 'elec_56', region: null, sort: 0 }],
  'newIMG_0203.png': [{ questionId: 'elec_57', region: null, sort: 0 }],
  'newIMG_0204.png': [{ questionId: 'elec_58', region: null, sort: 0 }],
  'newIMG_0205.png': [{ questionId: 'elec_59', region: null, sort: 0 }],
  'newIMG_0206.png': [{ questionId: 'elec_60', region: null, sort: 0 }],
  'newIMG_0207.png': [{ questionId: 'elec_61', region: null, sort: 0 }],
  'newIMG_0208.png': [{ questionId: 'elec_62', region: null, sort: 0 }],
  'newIMG_0209.png': [{ questionId: 'elec_63', region: null, sort: 0 }],
  'newIMG_0210.png': [{ questionId: 'elec_64', region: null, sort: 0 }],
  'newIMG_0211.png': [{ questionId: 'elec_65', region: null, sort: 0 }],
  'newIMG_0212.png': [{ questionId: 'elec_66', region: null, sort: 0 }],
  'newIMG_0213.png': [{ questionId: 'elec_67', region: null, sort: 0 }],
  // 解答またがり: 問68の問題文＋解答(別解①まで)
  'newIMG_0214.png': [{ questionId: 'elec_68', region: null, sort: 0 }],
  // 解答またがり: 問68の解答の続き(別解②・解説)
  'newIMG_0215.png': [{ questionId: 'elec_68', region: null, sort: 1 }],
  'newIMG_0216.png': [{ questionId: 'elec_69', region: null, sort: 0 }],
  // 0217.png = 問70 捨て問（H29-A2・コンデンサ接続と静電エネルギーの複合・対象外）
  // 解答またがり: 問71の問題文
  'newIMG_0218.png': [{ questionId: 'elec_71', region: null, sort: 0 }],
  // 解答またがり: 問71の解答の続き
  'newIMG_0219.png': [{ questionId: 'elec_71', region: null, sort: 1 }],
  'newIMG_0220.png': [{ questionId: 'elec_72', region: null, sort: 0 }],
  'newIMG_0221.png': [{ questionId: 'elec_73', region: null, sort: 0 }],
  'newIMG_0222.png': [{ questionId: 'elec_74', region: null, sort: 0 }],
  'newIMG_0223.png': [{ questionId: 'elec_75', region: null, sort: 0 }],
  'newIMG_0224.png': [{ questionId: 'elec_76', region: null, sort: 0 }],
}
