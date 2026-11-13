// 第38回の問の索引（ID・論点名・学習形態）。本文・解答欄・正答は含まない（DB の kk2_questions）。
// 論点名は問題文の抜粋ではなく短い見出し（リポジトリに本文を置かないため）。
import type { Kk2Master } from './types.ts'

export const K38_MASTERS: Kk2Master[] = [
  { id: 'K2_38_1_1', title: '株主配当金（源泉徴収）', studyMode: 'calc' },
  { id: 'K2_38_1_2', title: '社債の発行（社債発行費）', studyMode: 'calc' },
  { id: 'K2_38_1_3', title: '土地の購入', studyMode: 'calc' },
  { id: 'K2_38_1_4', title: '当座借越（二勘定制）', studyMode: 'calc' },
  { id: 'K2_38_1_5', title: '完成工事高（工事進行基準）', studyMode: 'calc' },
  { id: 'K2_38_2_1', title: '本支店会計（内部利益）', studyMode: 'calc' },
  { id: 'K2_38_2_2', title: '消費税（税抜方式）', studyMode: 'calc' },
  { id: 'K2_38_2_3', title: '賞与引当金', studyMode: 'calc' },
  { id: 'K2_38_2_4', title: '総合償却（平均耐用年数）', studyMode: 'calc' },
  { id: 'K2_38_3_1', title: '予定配賦（現場技術者の給料手当）', studyMode: 'calc' },
  { id: 'K2_38_4_1', title: '工事別原価計算表・配賦基準の分類', studyMode: 'calc' },
  { id: 'K2_38_5_1', title: '精算表', studyMode: 'calc' },
]
