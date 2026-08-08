// 理解度ステータス（S/A/B/C/未着手）の表示用定数。
import type { Status, StudyMode } from '../../domain/types'

// 学習場所（studyMode）の見出し用バッジ。絞り込みを開かなくてもカード上部で
// 「自宅（計算）／会社（暗記）」がぱっと見で分かるようにする（FilterBar の MODE_OPTIONS と対応）。
export const STUDYMODE_BADGE: Record<StudyMode, { label: string; cls: string; title: string }> = {
  calc:   { label: '🏠 自宅', cls: 'bg-sky-50 text-sky-700 border-sky-200',   title: '計算問題（立式・紙で式展開）。自宅向け' },
  memory: { label: '🏢 会社', cls: 'bg-amber-50 text-amber-700 border-amber-200', title: '暗記・概念問題（論説・穴埋・選択）。会社の休憩向け' },
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
