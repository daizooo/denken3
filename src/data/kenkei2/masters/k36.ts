// 第36回の問の索引（ID・論点名・学習形態）。本文・解答欄・正答は含まない（DB の kk2_questions）。
// 論点名は問題文の抜粋ではなく短い見出し（リポジトリに本文を置かないため）。
import type { Kk2Master } from './types.ts'

export const K36_MASTERS: Kk2Master[] = [
  { id: 'K2_36_1_1', title: '資本準備金の資本組入れ', studyMode: 'calc' },
  { id: 'K2_36_1_2', title: '公社債の購入（有価証券利息）', studyMode: 'calc' },
  { id: 'K2_36_1_3', title: '完成工事高（消費税）', studyMode: 'calc' },
  { id: 'K2_36_1_4', title: '本社建物の補修（資本的支出・収益的支出）', studyMode: 'calc' },
  { id: 'K2_36_1_5', title: '完成工事高（工事進行基準）', studyMode: 'calc' },
  { id: 'K2_36_2_1', title: '材料費（未成工事支出金・材料の期首期末）', studyMode: 'calc' },
  { id: 'K2_36_2_2', title: '銀行勘定調整', studyMode: 'calc' },
  { id: 'K2_36_2_3', title: '本支店会計（支店勘定）', studyMode: 'calc' },
  { id: 'K2_36_2_4', title: '労務費（賃金）', studyMode: 'calc' },
  { id: 'K2_36_3_1', title: '営業費の分類・工事別原価計算表', studyMode: 'calc' },
  { id: 'K2_36_4_1', title: '材料元帳（移動平均法・先入先出法・総平均法）', studyMode: 'calc' },
  { id: 'K2_36_5_1', title: '精算表', studyMode: 'calc' },
]
