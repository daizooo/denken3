// 1級土木の会社学習用テキスト（社労士の licensehub-expansion.md §6.3 と同じ運用。すべて純関数）。
//   - 単体コピー: 問題文 → 選択肢 → 「あなたの答え：」 → 25行の空行 → 【正答】【解説】
//   - 一括コピー: 番号付きで N 問。**正答・解説は含めない**（答え合わせは一括記録で番号だけ入力）
// 図は文字にできないため、図のある問は単体コピーに注記し、一括コピーからは外す（pickDbkBatch）。
import type { DbkQuestionRow } from './types.ts'
import { CHOICE_LABELS, STATEMENT_LABELS } from './explain.ts'
import { parseBatchSession, type BatchSession, type StorageLike } from '../license/batchSession.ts'

/** 社労士の単体コピー（itemText.ts）と同じ空行数。 */
export const DBK_ANSWER_GAP_LINES = 25

/** 一括コピーの問数（四肢択一は1問が長いため、社労士の肢より少なめ）。 */
export const DBK_BATCH_MIN = 3
export const DBK_BATCH_MAX = 20
export const DBK_BATCH_DEFAULT = 5

export function clampDbkBatchSize(n: number): number {
  if (!Number.isFinite(n)) return DBK_BATCH_DEFAULT
  return Math.min(DBK_BATCH_MAX, Math.max(DBK_BATCH_MIN, Math.round(n)))
}

export type DbkTextQuestion = Pick<DbkQuestionRow, 'year' | 'paper' | 'q_no' | 'stem' | 'statements' | 'choice_header' | 'choices' | 'has_figure'>

/** 見出し（例: R08 A No.3）。 */
export function dbkTitle(q: Pick<DbkQuestionRow, 'year' | 'paper' | 'q_no'>): string {
  return `${q.year} ${q.paper} No.${q.q_no}`
}

/** 問題文と選択肢（答えを含まない部分）。 */
export function formatDbkBody(q: DbkTextQuestion): string[] {
  const lines: string[] = [q.stem.trim()]
  if (q.has_figure) lines.push('（図あり：図はアプリで確認）')
  if (q.statements.length > 0) {
    lines.push('')
    q.statements.forEach((s, i) => lines.push(`${STATEMENT_LABELS[i]} ${s}`))
  }
  lines.push('')
  if (q.choice_header.length >= 2) lines.push(`　　${q.choice_header.join('　／　')}`)
  q.choices.forEach((c, i) => lines.push(`${CHOICE_LABELS[i]} ${c.join('　／　')}`))
  return lines
}

/** 単体コピー。貼り付け直後は問題だけが見え、スクロールしない限り答えが目に入らない。 */
export function formatDbkForClipboard(q: DbkTextQuestion & Pick<DbkQuestionRow, 'correct' | 'explain'>): string {
  const ex = q.explain
  const explain = ex
    ? [ex.point, ...ex.checks.map(c => `${c.label} ${c.ok ? '○' : '×'} ${c.note}`), ...(ex.basis ? [`根拠: ${ex.basis}`] : [])].join('\n')
    : '（解説は準備中）'
  return [
    `【1級土木 ${dbkTitle(q)}】`,
    '',
    ...formatDbkBody(q),
    '',
    'あなたの答え（⑴〜⑷ と 確信/迷い）：',
    '\n'.repeat(DBK_ANSWER_GAP_LINES),
    `【正答】${CHOICE_LABELS[q.correct - 1] ?? '（未確定）'}`,
    `【解説】${explain}`,
  ].join('\n')
}

/** 一括コピー。正答・解説は含めない。 */
export function formatDbkBatch(qs: DbkTextQuestion[], createdAt: string): string {
  const lines: string[] = [`【1級土木 一括演習】${qs.length}問（作成 ${createdAt}）`, '']
  qs.forEach((q, i) => {
    lines.push(`${i + 1}. （${dbkTitle(q)}）`, ...formatDbkBody(q), '')
  })
  lines.push('―― あなたの答え（⑴〜⑷ と 確信/迷い）――')
  qs.forEach((_, i) => lines.push(`${i + 1}. `))
  return lines.join('\n')
}

/** 一覧（表示順）から、図の無い問を先頭から n 件選ぶ。 */
export function pickDbkBatch(list: Pick<DbkQuestionRow, 'id' | 'has_figure'>[], n: number): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const q of list) {
    if (out.length >= n) break
    if (q.has_figure || seen.has(q.id)) continue
    seen.add(q.id)
    out.push(q.id)
  }
  return out
}

// ---- 組の保持（社労士の batchSession と同じ形。キーを分けて互いに上書きしない） ----

export const DBK_BATCH_SESSION_KEY = 'licensehub.dbkBatchSession.v1'

export function saveDbkBatch(storage: StorageLike | null, s: BatchSession): boolean {
  if (!storage) return false
  try { storage.setItem(DBK_BATCH_SESSION_KEY, JSON.stringify(s)); return true } catch { return false }
}

/** 壊れている・別ユーザーの組は破棄して null。 */
export function loadDbkBatch(storage: StorageLike | null, userId: string): BatchSession | null {
  if (!storage) return null
  let raw: string | null
  try { raw = storage.getItem(DBK_BATCH_SESSION_KEY) } catch { return null }
  if (raw === null) return null
  const s = parseBatchSession(raw)
  if (!s || s.userId !== userId) {
    try { storage.removeItem(DBK_BATCH_SESSION_KEY) } catch { /* 次の保存で上書き */ }
    return null
  }
  return s
}
