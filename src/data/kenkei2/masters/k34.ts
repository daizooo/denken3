// 第34回の問の索引（ID・論点名・学習形態）。本文・解答欄・正答は含まない（DB の kk2_questions）。
// 論点名は問題文の抜粋ではなく短い見出し（リポジトリに本文を置かないため）。
import type { Kk2Master } from './types.ts'

export const K34_MASTERS: Kk2Master[] = [
  { id: 'K2_34_1_1', title: '有価証券の売却', studyMode: 'calc' },
  { id: 'K2_34_1_2', title: '建設仮勘定（外注工事の前払い）', studyMode: 'calc' },
  { id: 'K2_34_1_3', title: '貸倒引当金と貸倒損失', studyMode: 'calc' },
  { id: 'K2_34_1_4', title: '資本準備金の資本組入れ', studyMode: 'calc' },
  { id: 'K2_34_1_5', title: '完成工事高（工事進行基準・追加請負金）', studyMode: 'calc' },
  { id: 'K2_34_2_1', title: '労務費（賃金）', studyMode: 'calc' },
  { id: 'K2_34_2_2', title: '本支店会計（支店勘定）', studyMode: 'calc' },
  { id: 'K2_34_2_3', title: '銀行勘定調整', studyMode: 'calc' },
  { id: 'K2_34_2_4', title: 'のれんの償却', studyMode: 'calc' },
  { id: 'K2_34_3_1', title: '勘定口座の記入・完成工事原価報告書', studyMode: 'calc' },
  { id: 'K2_34_4_1', title: '工事原価の算入区分・部門費振替表（直接配賦法）', studyMode: 'calc' },
  { id: 'K2_34_5_1', title: '精算表', studyMode: 'calc' },
]
