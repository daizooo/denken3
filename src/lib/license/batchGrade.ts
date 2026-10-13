// 一括コピー・一括記録の選定と採点（licensehub-expansion.md §6.3）。すべて純関数。
//
// 採点・理解度の写像は肢モードと同じ（attempt.ts の itemAttempt / statusFromAttempt）を使い、
// ここでは「組の選び方」「送信できるか」「行ごとの採点」だけを決める。
import type { Attempt, Confidence } from '../attempt'
import type { ReviewHistoryEntry } from '../../domain/types'
import { isAskableItem, type ItemBody } from './itemBody'
import { itemAttempt, statusFromAttempt, type ItemStatus } from './attempt'

/**
 * 今日の復習キュー（表示順）から、出題できる肢を先頭から n 件選ぶ。
 * 本文が取れていない・isAskableItem を満たさない肢は飛ばす（足りなければ取れた分だけ）。
 */
export function pickBatch(queueIds: string[], bodies: Record<string, ItemBody>, n: number): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of queueIds) {
    if (out.length >= n) break
    if (seen.has(id)) continue
    seen.add(id)
    if (isAskableItem(bodies[id])) out.push(id)
  }
  return out
}

/** 1行の入力（○/× と 確信/迷い）。 */
export interface BatchRowInput {
  answer: boolean | null
  confidence: Confidence | null
}

export const EMPTY_ROW: BatchRowInput = { answer: null, confidence: null }

export function isRowFilled(row: BatchRowInput | undefined): boolean {
  return !!row && row.answer !== null && row.confidence !== null
}

/**
 * 送信できるか。**未記録の行がすべて入力済み（○/× と 確信/迷い の両方）のときだけ**送信できる。
 * 未入力の行を残したまま送ると、その肢は記録されずに解説だけ見えてしまう（答えを見てから
 * 入力できる）ため、部分送信は認めない。
 */
export function canSubmitBatch(pendingIds: string[], inputs: Record<string, BatchRowInput>): boolean {
  return pendingIds.length > 0 && pendingIds.every(id => isRowFilled(inputs[id]))
}

export interface BatchRowResult {
  status: ItemStatus
  attempt: Attempt
  correct: boolean
}

/** 1行を採点する（ItemSolver と同じ写像）。入力が欠けていれば null。 */
export function gradeBatchRow(row: BatchRowInput | undefined, truth: boolean): BatchRowResult | null {
  if (!row || !isRowFilled(row)) return null
  const attempt = itemAttempt(row.answer, row.confidence ?? undefined, false, truth)
  const correct = attempt.correct === true
  return { status: statusFromAttempt(correct, attempt.confidence, false), attempt, correct }
}

/** 取り消し対象の履歴の位置（記録した日付・理解度に一致する最後のもの）。無ければ -1。 */
export function findRecordIndex(
  history: ReviewHistoryEntry[], rec: { date: string; status: string },
): number {
  return history.findLastIndex(e => e.date === rec.date && e.status === rec.status)
}
