// 自動生成: 単相交流(ac1)章の画像→問題マッピング（章フォルダ全画像のヘッダー実読で突合）。
// ドロップされたファイル名から紐付け先の問題(question_id)を引く。捨て問画像は含めない。
// 変則:
//  - 2問同居(0371,0372): 1画像に2問。上バンド=小番号(region 'top')/下バンド=大番号(region 'bottom')。
//  - 解答またがり(0382+0383): 問29は問題(sort 0)と解答の続き(sort 1)で画像2枚。
//  - 捨て問(問42/49/51 = 0396/0403/0405)はマッピングに含めない。
// short_answer_flag は全問 false のため answerYPct は既定(100)。
import type { AssetMap } from '../lib/assets'

export const AC1_ASSETS: AssetMap = {
  'newIMG_0356.png': [{ questionId: 'ac1_1', region: null, sort: 0 }],
  'newIMG_0357.png': [{ questionId: 'ac1_2', region: null, sort: 0 }],
  'newIMG_0358.png': [{ questionId: 'ac1_3', region: null, sort: 0 }],
  'newIMG_0359.png': [{ questionId: 'ac1_4', region: null, sort: 0 }],
  'newIMG_0360.png': [{ questionId: 'ac1_5', region: null, sort: 0 }],
  'newIMG_0361.png': [{ questionId: 'ac1_6', region: null, sort: 0 }],
  'newIMG_0362.png': [{ questionId: 'ac1_7', region: null, sort: 0 }],
  'newIMG_0363.png': [{ questionId: 'ac1_8', region: null, sort: 0 }],
  'newIMG_0364.png': [{ questionId: 'ac1_9', region: null, sort: 0 }],
  'newIMG_0365.png': [{ questionId: 'ac1_10', region: null, sort: 0 }],
  'newIMG_0366.png': [{ questionId: 'ac1_11', region: null, sort: 0 }],
  'newIMG_0367.png': [{ questionId: 'ac1_12', region: null, sort: 0 }],
  'newIMG_0368.png': [{ questionId: 'ac1_13', region: null, sort: 0 }],
  'newIMG_0369.png': [{ questionId: 'ac1_14', region: null, sort: 0 }],
  'newIMG_0370.png': [{ questionId: 'ac1_15', region: null, sort: 0 }],
  // 2問同居: 問16(上)＋問17(下)
  'newIMG_0371.png': [{ questionId: 'ac1_16', region: 'top', sort: 0 }, { questionId: 'ac1_17', region: 'bottom', sort: 0 }],
  // 2問同居: 問18(上)＋問19(下)
  'newIMG_0372.png': [{ questionId: 'ac1_18', region: 'top', sort: 0 }, { questionId: 'ac1_19', region: 'bottom', sort: 0 }],
  'newIMG_0373.png': [{ questionId: 'ac1_20', region: null, sort: 0 }],
  'newIMG_0374.png': [{ questionId: 'ac1_21', region: null, sort: 0 }],
  'newIMG_0375.png': [{ questionId: 'ac1_22', region: null, sort: 0 }],
  'newIMG_0376.png': [{ questionId: 'ac1_23', region: null, sort: 0 }],
  'newIMG_0377.png': [{ questionId: 'ac1_24', region: null, sort: 0 }],
  'newIMG_0378.png': [{ questionId: 'ac1_25', region: null, sort: 0 }],
  'newIMG_0379.png': [{ questionId: 'ac1_26', region: null, sort: 0 }],
  'newIMG_0380.png': [{ questionId: 'ac1_27', region: null, sort: 0 }],
  'newIMG_0381.png': [{ questionId: 'ac1_28', region: null, sort: 0 }],
  // 解答またがり: 問29の問題文
  'newIMG_0382.png': [{ questionId: 'ac1_29', region: null, sort: 0 }],
  // 解答またがり: 問29の解答の続き
  'newIMG_0383.png': [{ questionId: 'ac1_29', region: null, sort: 1 }],
  'newIMG_0384.png': [{ questionId: 'ac1_30', region: null, sort: 0 }],
  'newIMG_0385.png': [{ questionId: 'ac1_31', region: null, sort: 0 }],
  'newIMG_0386.png': [{ questionId: 'ac1_32', region: null, sort: 0 }],
  'newIMG_0387.png': [{ questionId: 'ac1_33', region: null, sort: 0 }],
  'newIMG_0388.png': [{ questionId: 'ac1_34', region: null, sort: 0 }],
  'newIMG_0389.png': [{ questionId: 'ac1_35', region: null, sort: 0 }],
  'newIMG_0390.png': [{ questionId: 'ac1_36', region: null, sort: 0 }],
  'newIMG_0391.png': [{ questionId: 'ac1_37', region: null, sort: 0 }],
  'newIMG_0392.png': [{ questionId: 'ac1_38', region: null, sort: 0 }],
  'newIMG_0393.png': [{ questionId: 'ac1_39', region: null, sort: 0 }],
  'newIMG_0394.png': [{ questionId: 'ac1_40', region: null, sort: 0 }],
  'newIMG_0395.png': [{ questionId: 'ac1_41', region: null, sort: 0 }],
  // 0396.png = 問42 捨て問（対象外）
  'newIMG_0397.png': [{ questionId: 'ac1_43', region: null, sort: 0 }],
  'newIMG_0398.png': [{ questionId: 'ac1_44', region: null, sort: 0 }],
  'newIMG_0399.png': [{ questionId: 'ac1_45', region: null, sort: 0 }],
  'newIMG_0400.png': [{ questionId: 'ac1_46', region: null, sort: 0 }],
  'newIMG_0401.png': [{ questionId: 'ac1_47', region: null, sort: 0 }],
  'newIMG_0402.png': [{ questionId: 'ac1_48', region: null, sort: 0 }],
  // 0403.png = 問49 捨て問（対象外）
  'newIMG_0404.png': [{ questionId: 'ac1_50', region: null, sort: 0 }],
  // 0405.png = 問51 捨て問（対象外）
  'newIMG_0406.png': [{ questionId: 'ac1_52', region: null, sort: 0 }],
  'newIMG_0407.png': [{ questionId: 'ac1_53', region: null, sort: 0 }],
  'newIMG_0408.png': [{ questionId: 'ac1_54', region: null, sort: 0 }],
  'newIMG_0409.png': [{ questionId: 'ac1_55', region: null, sort: 0 }],
  'newIMG_0410.png': [{ questionId: 'ac1_56', region: null, sort: 0 }],
  'newIMG_0411.png': [{ questionId: 'ac1_57', region: null, sort: 0 }],
  'newIMG_0412.png': [{ questionId: 'ac1_58', region: null, sort: 0 }],
  'newIMG_0413.png': [{ questionId: 'ac1_59', region: null, sort: 0 }],
  'newIMG_0414.png': [{ questionId: 'ac1_60', region: null, sort: 0 }],
  'newIMG_0415.png': [{ questionId: 'ac1_61', region: null, sort: 0 }],
  'newIMG_0416.png': [{ questionId: 'ac1_62', region: null, sort: 0 }],
  'newIMG_0417.png': [{ questionId: 'ac1_63', region: null, sort: 0 }],
  'newIMG_0418.png': [{ questionId: 'ac1_64', region: null, sort: 0 }],
  'newIMG_0419.png': [{ questionId: 'ac1_65', region: null, sort: 0 }],
  'newIMG_0420.png': [{ questionId: 'ac1_66', region: null, sort: 0 }],
  'newIMG_0421.png': [{ questionId: 'ac1_67', region: null, sort: 0 }],
  'newIMG_0422.png': [{ questionId: 'ac1_68', region: null, sort: 0 }],
  'newIMG_0423.png': [{ questionId: 'ac1_69', region: null, sort: 0 }],
  'newIMG_0424.png': [{ questionId: 'ac1_70', region: null, sort: 0 }],
  'newIMG_0425.png': [{ questionId: 'ac1_71', region: null, sort: 0 }],
  'newIMG_0426.png': [{ questionId: 'ac1_72', region: null, sort: 0 }],
}
