// 選択式の空欄を1問として解く（肢モードの選択式版。licensehub-expansion.md §6.1）。すべて純関数。
//
// 空欄ごとに語群（20語。年度により空欄ごとに分かれる）から1語を選ぶ。正解は問（lic_questions）の
// answer_spec.blanks[空欄] が指す語群の番号。肢（lic_items）の truth は選択式では使わない（null）。
// 記録は択一式の肢と同じ経路（理解度 A/B/C → FSRS）。確信／迷い・降参の写像は attempt.ts のまま。
import { parseItemId, type AnswerSpec, type ItemLabel } from '../../domain/license'
import type { Attempt, Confidence } from '../attempt'
import type { ItemBody } from './itemBody'
import { blankChoices } from './textMock'

export function isSentakuItemId(id: string): boolean {
  return parseItemId(id)?.format === 'sentaku'
}

/** 肢ID（R06_S_RK_A）→ 問ID（R06_S_RK）。選択式でなければ null。 */
export function sentakuQuestionId(itemId: string): string | null {
  const c = parseItemId(itemId)
  return c && c.format === 'sentaku' ? itemId.slice(0, -2) : null
}

/** 正解の語群番号（answer_spec に無い・語群に無ければ null）。 */
export function correctWordNo(spec: AnswerSpec | null, label: ItemLabel): number | null {
  if (!spec || spec.kind !== 'sentaku') return null
  const n = spec.blanks[label]
  return typeof n === 'number' && spec.wordbank[String(n)] !== undefined ? n : null
}

/**
 * 出題してよいか（択一式の isAskableItem に相当）。
 * - 本文が無い・空 → 出さない
 * - law_status が 'ok' 以外 → 出さない（法改正の確認待ち・除外）
 * - 正答（空欄 → 語群の番号）が無い／語群が無い → 出さない
 */
export function isAskableSentaku(body: ItemBody | undefined | null, spec: AnswerSpec | null): body is ItemBody {
  if (!body || typeof body.statement !== 'string' || body.statement.trim() === '') return false
  if (body.law_status !== 'ok') return false
  return correctWordNo(spec, body.label) !== null
}

/** 空欄 label で選べる語（語群の番号と語句）。 */
export function wordChoices(spec: AnswerSpec | null, label: ItemLabel): { no: number; word: string }[] {
  if (!spec || spec.kind !== 'sentaku') return []
  return blankChoices(spec, label).map(no => ({ no, word: spec.wordbank[String(no)] ?? '' }))
}

/**
 * 記録に残す Attempt。selected は選んだ語の語群番号、correct は記録時点の正誤
 * （後で answer_spec が直っても履歴は動かさない）。
 */
export function sentakuAttempt(
  picked: number | null, confidence: Confidence | undefined, gaveUp: boolean, correctNo: number,
): Attempt {
  if (gaveUp || picked === null) return { gaveUp: true, correct: false }
  return {
    selected: [picked],
    ...(confidence ? { confidence } : {}),
    correct: picked === correctNo,
  }
}

export type StatementPart = { text: string } | { mark: ItemLabel }

/** 本文を「地の文」と空欄の印（［A］）に分ける。印は全角［］・半角[]のどちらも読む。 */
export function splitBlanks(statement: string): StatementPart[] {
  const parts: StatementPart[] = []
  const re = /[［[]([A-E])[］\]]/g
  let last = 0
  for (const m of statement.matchAll(re)) {
    const at = m.index ?? 0
    if (at > last) parts.push({ text: statement.slice(last, at) })
    parts.push({ mark: m[1] as ItemLabel })
    last = at + m[0].length
  }
  if (last < statement.length) parts.push({ text: statement.slice(last) })
  return parts
}
