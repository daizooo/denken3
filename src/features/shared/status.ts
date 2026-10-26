// 理解度ステータス（S/A/B/C/未着手）の表示用定数。
import type { Status } from '../../domain/types'

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
