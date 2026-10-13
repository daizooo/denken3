// 一括コピー用のテキスト（licensehub-expansion.md §6.3「一括コピー」）。
//
// 番号付きの肢を1つのテキストにまとめる。**答え（truth）・解説は含めない**。
// 単体コピー（itemText.ts）と違い、25行の空行の下にも答えを置かない ―― 答え合わせは
// BatchGrade で番号だけを入力して行う（画面を見ながら解かない運用）。
//
// 引数は statement だけを受け取る型にして、truth・explanation を渡せないようにしておく。
import type { ItemBody } from './itemBody'

export type BatchTextItem = Pick<ItemBody, 'statement'>

/** 肢の数の範囲（既定10、5〜30）。 */
export const BATCH_MIN = 5
export const BATCH_MAX = 30
export const BATCH_DEFAULT = 10

/** 入力された件数を 5〜30 の整数に丸める。数でなければ既定値。 */
export function clampBatchSize(n: number): number {
  if (!Number.isFinite(n)) return BATCH_DEFAULT
  return Math.min(BATCH_MAX, Math.max(BATCH_MIN, Math.round(n)))
}

/**
 * 一括コピーのテキスト。
 *   見出し → 1. 本文 … N. 本文 → 「あなたの答え」の記入欄（番号だけ）
 * createdAt は組の作成日時（表示用。BatchGrade の見出しと揃える）。
 */
export function formatBatchForClipboard(items: BatchTextItem[], createdAt: string): string {
  const lines: string[] = [
    `【一括演習】${items.length}肢　○ か × か（作成 ${createdAt}）`,
    '',
  ]
  items.forEach((it, i) => {
    lines.push(`${i + 1}.`, it.statement.trim(), '')
  })
  lines.push('―― あなたの答え（○/× と 確信/迷い）――')
  items.forEach((_, i) => lines.push(`${i + 1}. `))
  return lines.join('\n')
}

/** 表示用の作成日時（JST の YYYY-MM-DD HH:MM）。 */
export function formatBatchCreatedAt(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const d = new Date(t + 9 * 60 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}
