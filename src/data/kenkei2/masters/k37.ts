// 第37回の問の索引（ID・論点名・学習形態）。本文・解答欄・正答は含まない（DB の kk2_questions）。
// 論点名は問題文の抜粋ではなく短い見出し（リポジトリに本文を置かないため）。
import type { Kk2Master } from './types.ts'

export const K37_MASTERS: Kk2Master[] = [
  { id: 'K2_37_1_1', title: '剰余金の配当（利益準備金）', studyMode: 'calc' },
  { id: 'K2_37_1_2', title: '法人税等の納付', studyMode: 'calc' },
  { id: 'K2_37_1_3', title: '車両運搬具の売却', studyMode: 'calc' },
  { id: 'K2_37_1_4', title: '貸倒引当金と貸倒損失', studyMode: 'calc' },
  { id: 'K2_37_1_5', title: '完成工事高（工事進行基準）', studyMode: 'calc' },
  { id: 'K2_37_2_1', title: '社債の買入償還', studyMode: 'calc' },
  { id: 'K2_37_2_2', title: '固定資産の焼失（保険金）', studyMode: 'calc' },
  { id: 'K2_37_2_3', title: '棚卸減耗・材料評価損', studyMode: 'calc' },
  { id: 'K2_37_2_4', title: 'のれんの償却', studyMode: 'calc' },
  { id: 'K2_37_3_1', title: '勘定口座の記入・完成工事原価報告書', studyMode: 'calc' },
  { id: 'K2_37_4_1', title: '引当金の設定基準・部門費振替表（階梯式配賦法）', studyMode: 'calc' },
  { id: 'K2_37_5_1', title: '精算表', studyMode: 'calc' },
]
