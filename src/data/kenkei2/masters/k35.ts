// 第35回の問の索引（ID・論点名・学習形態）。本文・解答欄・正答は含まない（DB の kk2_questions）。
// 論点名は問題文の抜粋ではなく短い見出し（リポジトリに本文を置かないため）。
import type { Kk2Master } from './types.ts'

export const K35_MASTERS: Kk2Master[] = [
  { id: 'K2_35_1_1', title: '剰余金の配当（利益準備金）', studyMode: 'calc' },
  { id: 'K2_35_1_2', title: '社債の発行（社債発行費）', studyMode: 'calc' },
  { id: 'K2_35_1_3', title: '固定資産の売却（直接法）', studyMode: 'calc' },
  { id: 'K2_35_1_4', title: '賞与引当金の取崩し', studyMode: 'calc' },
  { id: 'K2_35_1_5', title: '仮設材料のすくい出し方式', studyMode: 'calc' },
  { id: 'K2_35_2_1', title: '完成工事高（工事進行基準）', studyMode: 'calc' },
  { id: 'K2_35_2_2', title: '前払利息', studyMode: 'calc' },
  { id: 'K2_35_2_3', title: '株式の売却損益', studyMode: 'calc' },
  { id: 'K2_35_2_4', title: '総合償却（平均耐用年数）', studyMode: 'calc' },
  { id: 'K2_35_3_1', title: '予定配賦（現場監督者の給与手当）', studyMode: 'calc' },
  { id: 'K2_35_4_1', title: '工事原価明細表・工事原価計算の種類', studyMode: 'calc' },
  { id: 'K2_35_5_1', title: '精算表', studyMode: 'calc' },
]
