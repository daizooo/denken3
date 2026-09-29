// 理解度ステータス（S/A/B/C/未着手）の表示用定数。
import type { Status } from '../../domain/types'
import { hasQuestionText } from '../../lib/questionText'

// 学習場所（会社/自宅）。テキストコピー（転記）ができる問題だけを「会社」、それ以外は
// すべて「自宅」とする。studyMode（計算/暗記）とは別軸（studyMode は所要時間の推定用に残す）。
export type StudyPlace = 'home' | 'company'
export function studyPlaceOf(questionId: string): StudyPlace {
  return hasQuestionText(questionId) ? 'company' : 'home'
}

// 学習場所の見出し用バッジ。絞り込みを開かなくてもカード上部で「自宅／会社」が分かるようにする
// （FilterBar の MODE_OPTIONS と対応）。
export const STUDYMODE_BADGE: Record<StudyPlace, { label: string; cls: string; title: string }> = {
  home:    { label: '🏠 自宅', cls: 'bg-sky-50 text-sky-700 border-sky-200',   title: 'テキストコピーができない問題。自宅向け' },
  company: { label: '🏢 会社', cls: 'bg-amber-50 text-amber-700 border-amber-200', title: 'テキストコピーができる問題。会社の休憩向け' },
}

export const STATUS_BG: Record<Status, string> = {
  'S':    'bg-purple-100 text-purple-800 border-purple-300',
  'A':    'bg-green-100 text-green-800 border-green-300',
  'B':    'bg-blue-100 text-blue-800 border-blue-300',
  'C':    'bg-red-100 text-red-800 border-red-300',
  '未着手': 'bg-gray-100 text-gray-800 border-gray-300',
}

export const STATUS_COLOR: Record<Status, string> = {
  'S': '#a855f7', 'A': '#22c55e', 'B': '#3b82f6', 'C': '#ef4444', '未着手': '#9ca3af',
}

export const STATUS_LABEL: Record<Status, string> = {
  'S': 'S（完璧に理解した・復習不要）',
  'A': 'A（答えを見ずに解けた）',
  'B': 'B（方向性OK・計算ミス）',
  'C': 'C（答えを見た）',
  '未着手': '未着手',
}
