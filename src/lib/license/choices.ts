// 肢の解答ボタン（ItemSolver・BatchGrade 共通）。1タップで ○/× と確信/迷い（または降参）が決まる。
// 「？」付きが迷い、付かないものが確信（licensehub-expansion.md §6.1・§6.2 の写像は attempt.ts のまま）。
import type { Confidence } from '../attempt'

export interface ItemChoice {
  key: 'right' | 'right-unsure' | 'wrong-unsure' | 'wrong' | 'giveup'
  label: string
  answer: boolean | null      // 肢が正しい（true）／誤り（false）と答えた。降参は null
  confidence: Confidence | null
  gaveUp: boolean
}

export const ITEM_CHOICES: readonly ItemChoice[] = [
  { key: 'right',        label: '正しい',    answer: true,  confidence: 'sure',   gaveUp: false },
  { key: 'right-unsure', label: '正しい？',  answer: true,  confidence: 'unsure', gaveUp: false },
  { key: 'wrong-unsure', label: '誤り？',    answer: false, confidence: 'unsure', gaveUp: false },
  { key: 'wrong',        label: '誤り',      answer: false, confidence: 'sure',   gaveUp: false },
  { key: 'giveup',       label: '分からない', answer: null,  confidence: null,     gaveUp: true },
]

export function choiceOf(key: ItemChoice['key']): ItemChoice {
  return ITEM_CHOICES.find(c => c.key === key)!
}
