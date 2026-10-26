// 書籍の選択式（空欄補充）の書き起こしJSONのスキーマ・検証・公式との突合（docs/book-ingest/sentaku-spec.md）。
// 保存用の SQL は sentakuSql.ts。
//
// 択一式の基盤（schema.ts）は1問=5肢の○×が前提のため触らず、選択式は別ファイルで扱う。
// 1問 = 1年度×1科目（RK 労基安衛 / RS 労災）、空欄 A〜E、語群①〜⑳。
//
// 検証に失敗した問は理由つきの一覧にして保存しない（無理に通さない）。
// scripts/license/*.mjs からも Node の型除去で直接読むため、import は拡張子 .ts 付きで書く。
import type { AnswerSpec, ItemLabel } from '../../../domain/license.ts'
import { ITEM_LABELS, makeItemId, parseQuestionId } from '../../../domain/license.ts'
import { SHAROUSHI_SUBJECTS } from '../../../data/sharoushi/index.ts'
import { FIXTURE_YEARS } from './schema.ts'

// 本書（一問一答①）に選択式が載る採点科目と、空欄に付けられる学習科目。
// 労基安衛は空欄ごとに労基法（rouki）か安衛法（anei）かが分かれる（空欄の根拠条文で決まる）。
export const SENTAKU_BOOK_STUDY: Readonly<Record<string, readonly string[]>> = {
  RK: ['rouki', 'anei'],
  RS: ['rousai'],
}

// 問の学習科目（lic_questions.study_subject）。公式PDFの取り込み（subjects.ts）と同じ値にする。
const QUESTION_STUDY: Readonly<Record<string, string>> = { RK: 'rouki', RS: 'rousai' }

export const WORDBANK_SIZE = 20

const STUDY_IDS = new Set(SHAROUSHI_SUBJECTS.map(s => s.id))
const YEAR_RE = /^[HR]\d{2}$/

export interface TranscribedBlank {
  label: string
  statement: string
  explanation?: string | null
  study_subject?: string
}

export interface TranscribedSentaku {
  question_id: string
  wordbank: Record<string, string>
  blanks: Record<string, number>
  items: TranscribedBlank[]
  _meta?: unknown   // 検証用（DBに入れない）
}

const KNOWN_QUESTION_KEYS = new Set(['question_id', 'wordbank', 'blanks', 'items', '_meta'])
const KNOWN_ITEM_KEYS = new Set(['label', 'statement', 'explanation', 'study_subject'])

export interface ValidBlank {
  itemId: string            // 'R03_S_RK_C'
  label: ItemLabel
  statement: string
  explanation: string | null
  studySubject: string
}

export interface ValidSentaku {
  index: number
  questionId: string        // 'R03_S_RK'
  year: string
  scoredSubject: string
  studySubject: string
  wordbank: Record<string, string>
  blanks: Record<ItemLabel, number>
  items: ValidBlank[]
}

export interface SentakuError {
  index: number
  questionId: string | null
  reasons: string[]
}

export interface SentakuValidation {
  valid: ValidSentaku[]
  errors: SentakuError[]
}

export interface SentakuValidateOptions {
  fixture?: boolean   // true: フィクスチャ年度だけを許す / false: フィクスチャ年度を拒否する
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// 空欄の表記は全角の ［A］ に統一する（既存の公式の取り込みと同じ。parseSentaku.ts の sentenceWithBlank）。
export const blankMark = (label: ItemLabel) => `［${label}］`

function validateOne(raw: unknown, index: number, opts: SentakuValidateOptions): ValidSentaku | SentakuError {
  if (!isObject(raw)) return { index, questionId: null, reasons: ['問がオブジェクトでない'] }
  const reasons: string[] = []
  const questionId = typeof raw.question_id === 'string' ? raw.question_id.trim() : null

  const unknown = Object.keys(raw).filter(k => !KNOWN_QUESTION_KEYS.has(k))
  if (unknown.length > 0) reasons.push(`不明な項目（綴りの誤り？）: ${unknown.join(', ')}`)

  // 問ID: {年度}_S_{RK|RS}
  let year = ''
  let scoredSubject = ''
  if (!questionId) {
    reasons.push('question_id が無い・空')
  } else {
    const coord = parseQuestionId(questionId)
    if (!coord || coord.format !== 'sentaku' || !YEAR_RE.test(coord.year)) {
      reasons.push(`question_id の形式が不正（{年度}_S_{科目}、例 R03_S_RK）: ${questionId}`)
    } else if (!(coord.scoredSubject in SENTAKU_BOOK_STUDY)) {
      reasons.push(`本書の選択式に無い科目コード（RK / RS のみ）: ${coord.scoredSubject}`)
    } else {
      year = coord.year
      scoredSubject = coord.scoredSubject
      const isFixtureYear = FIXTURE_YEARS.includes(year)
      if (opts.fixture && !isFixtureYear) reasons.push(`フィクスチャの取り込みでは年度は ${FIXTURE_YEARS.join('/')} のみ: ${year}`)
      else if (!opts.fixture && isFixtureYear) reasons.push(`フィクスチャ専用の年度（--fixture を付けて取り込む）: ${year}`)
    }
  }

  // 語群: 番号 '1'〜'20' がそろい、語句が空でない。
  const wordbank: Record<string, string> = {}
  if (!isObject(raw.wordbank)) {
    reasons.push('wordbank が無い・オブジェクトでない')
  } else {
    const expected = Array.from({ length: WORDBANK_SIZE }, (_, i) => String(i + 1))
    const keys = Object.keys(raw.wordbank)
    const missing = expected.filter(k => !keys.includes(k))
    const extra = keys.filter(k => !expected.includes(k))
    if (missing.length > 0) reasons.push(`語群が ${WORDBANK_SIZE} 語そろっていない（足りない番号: ${missing.join(',')}）`)
    if (extra.length > 0) reasons.push(`語群に範囲外の番号: ${extra.join(',')}`)
    for (const k of keys) {
      const w = raw.wordbank[k]
      if (typeof w !== 'string' || w.trim() === '') reasons.push(`語群 ${k} の語句が空・文字列でない`)
      else wordbank[k] = w.trim()
    }
  }

  // 解答: 空欄 A〜E の5件、値は語群の番号。
  const blanks: Partial<Record<ItemLabel, number>> = {}
  if (!isObject(raw.blanks)) {
    reasons.push('blanks が無い・オブジェクトでない')
  } else {
    const keys = Object.keys(raw.blanks)
    const bad = keys.filter(k => !(ITEM_LABELS as readonly string[]).includes(k))
    if (bad.length > 0) reasons.push(`blanks に A〜E 以外の空欄: ${bad.join(',')}`)
    for (const label of ITEM_LABELS) {
      const n = raw.blanks[label]
      if (n === undefined) reasons.push(`blanks に空欄 ${label} が無い`)
      else if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > WORDBANK_SIZE) reasons.push(`blanks.${label} が語群の番号（1〜${WORDBANK_SIZE}）でない: ${JSON.stringify(n)}`)
      else if (!(String(n) in wordbank)) reasons.push(`blanks.${label} の ${n} が語群に無い`)
      else blanks[label] = n as number
    }
  }

  // 空欄ごとの本文: A〜E が1つずつ。本文はその空欄 ［X］ を含む。
  const items: ValidBlank[] = []
  if (!Array.isArray(raw.items)) {
    reasons.push('items が無い・配列でない')
  } else {
    const seen = new Set<string>()
    raw.items.forEach((it: unknown, i: number) => {
      const at = `items[${i}]`
      if (!isObject(it)) { reasons.push(`${at} がオブジェクトでない`); return }
      const itemUnknown = Object.keys(it).filter(k => !KNOWN_ITEM_KEYS.has(k))
      if (itemUnknown.length > 0) reasons.push(`${at} に不明な項目: ${itemUnknown.join(', ')}`)
      if (typeof it.label !== 'string' || !(ITEM_LABELS as readonly string[]).includes(it.label)) {
        reasons.push(`${at}.label が A〜E でない: ${JSON.stringify(it.label)}`)
        return
      }
      const label = it.label as ItemLabel
      if (seen.has(label)) { reasons.push(`空欄 ${label} が重複`); return }
      seen.add(label)

      const statement = typeof it.statement === 'string' ? it.statement.trim() : ''
      if (statement === '') reasons.push(`空欄 ${label}: statement が無い・空`)
      else if (!statement.includes(blankMark(label))) reasons.push(`空欄 ${label}: statement に ${blankMark(label)} が無い（空欄は全角の ［A］ に統一）`)

      let explanation: string | null = null
      if (it.explanation !== undefined && it.explanation !== null) {
        if (typeof it.explanation !== 'string') reasons.push(`空欄 ${label}: explanation が文字列でない`)
        else explanation = it.explanation.trim() === '' ? null : it.explanation.trim()
      }

      const allowed = scoredSubject ? SENTAKU_BOOK_STUDY[scoredSubject] : []
      let studySubject = ''
      const studyRaw = it.study_subject ?? (scoredSubject && allowed.length === 1 ? allowed[0] : undefined)
      if (typeof studyRaw !== 'string' || studyRaw === '') {
        reasons.push(`空欄 ${label}: study_subject が無い（労基安衛は空欄ごとに rouki / anei を書く）`)
      } else if (!STUDY_IDS.has(studyRaw)) {
        reasons.push(`空欄 ${label}: 学習科目が未知: ${studyRaw}`)
      } else if (scoredSubject && !allowed.includes(studyRaw)) {
        reasons.push(`空欄 ${label}: 学習科目 ${studyRaw} は ${scoredSubject} の選択式に含まれない（${allowed.join(' / ')}）`)
      } else {
        studySubject = studyRaw
      }

      if (statement && studySubject && scoredSubject) {
        items.push({ itemId: makeItemId({ year, format: 'sentaku', scoredSubject, qNo: null, label }), label, statement, explanation, studySubject })
      }
    })
    const missing = ITEM_LABELS.filter(l => !seen.has(l))
    if (missing.length > 0) reasons.push(`items に空欄 ${missing.join(',')} が無い（A〜E の5件が必要）`)
  }

  if (reasons.length > 0 || !questionId) return { index, questionId, reasons }
  items.sort((a, b) => a.label.localeCompare(b.label))
  return {
    index, questionId, year, scoredSubject,
    studySubject: QUESTION_STUDY[scoredSubject],
    wordbank, blanks: blanks as Record<ItemLabel, number>, items,
  }
}

// 書き起こしJSON（問の配列）を検証する。問IDの重複は該当の全問を失敗にする（どちらが正しいか決められないため）。
export function validateSentaku(input: unknown, opts: SentakuValidateOptions = {}): SentakuValidation {
  if (!Array.isArray(input)) {
    return { valid: [], errors: [{ index: -1, questionId: null, reasons: ['JSON の最上位が問の配列でない'] }] }
  }
  const results = input.map((raw, i) => validateOne(raw, i, opts))
  const ok = results.filter((r): r is ValidSentaku => 'items' in r)
  const errors = results.filter((r): r is SentakuError => !('items' in r))

  const byId = new Map<string, ValidSentaku[]>()
  for (const v of ok) byId.set(v.questionId, [...(byId.get(v.questionId) ?? []), v])
  const dup = new Map<number, string>()
  for (const [id, vs] of byId) {
    if (vs.length < 2) continue
    const at = vs.map(v => `#${v.index}`).join(', ')
    for (const v of vs) dup.set(v.index, `問IDが重複: ${id}（${at}）`)
  }
  const valid = ok.filter(v => !dup.has(v.index))
  const allErrors = [
    ...errors,
    ...ok.filter(v => dup.has(v.index)).map(v => ({ index: v.index, questionId: v.questionId, reasons: [dup.get(v.index)!] })),
  ].sort((a, b) => a.index - b.index)
  return { valid, errors: allErrors }
}

// ---------------------------------------------------------------------------
// 公式（既存の lic_questions.answer_spec）との突合（spec §4 の3）
//
// 公式の stem・answer_spec は守り、書籍の blanks / wordbank が一致するかだけ見る。
// 食い違いは書き起こしの誤りか公式との差かを確認する対象（保存の可否には使わない）。

export interface OfficialDiff { questionId: string; reasons: string[] }

export function compareWithOfficial(v: ValidSentaku, official: AnswerSpec | null): OfficialDiff | null {
  if (!official || official.kind !== 'sentaku') return { questionId: v.questionId, reasons: ['公式の answer_spec が選択式でない・無い'] }
  const reasons: string[] = []
  for (const label of ITEM_LABELS) {
    const a = v.blanks[label]
    const b = official.blanks[label]
    if (a !== b) reasons.push(`空欄 ${label} の正答: 書籍 ${a} / 公式 ${b ?? '(なし)'}`)
  }
  const nums = [...new Set([...Object.keys(v.wordbank), ...Object.keys(official.wordbank)])].sort((a, b) => Number(a) - Number(b))
  for (const n of nums) {
    const a = v.wordbank[n]
    const b = official.wordbank[n]
    if (a !== b) reasons.push(`語群 ${n}: 書籍「${a ?? '(なし)'}」/ 公式「${b ?? '(なし)'}」`)
  }
  return reasons.length > 0 ? { questionId: v.questionId, reasons } : null
}

// ---------------------------------------------------------------------------
// 件数の報告

export interface SentakuSummary {
  questions: number
  blanks: number
  byYear: Record<string, number>
  byScoredSubject: Record<string, number>
  byStudySubject: Record<string, number>
}

const countBy = <T>(xs: T[], key: (x: T) => string): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const x of xs) out[key(x)] = (out[key(x)] ?? 0) + 1
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}

export function summarizeSentaku(valid: ValidSentaku[]): SentakuSummary {
  const blanks = valid.flatMap(v => v.items.map(it => ({ v, it })))
  return {
    questions: valid.length,
    blanks: blanks.length,
    byYear: countBy(valid, v => v.year),
    byScoredSubject: countBy(valid, v => v.scoredSubject),
    byStudySubject: countBy(blanks, b => b.it.studySubject),
  }
}

const fmtCounts = (r: Record<string, number>) =>
  Object.keys(r).length === 0 ? '0' : Object.entries(r).map(([k, n]) => `${k} ${n}`).join(' / ')

export function formatSentakuSummary(s: SentakuSummary): string[] {
  return [
    `問 ${s.questions} 件（空欄 ${s.blanks} 件）`,
    `  採点科目別: ${fmtCounts(s.byScoredSubject)}`,
    `  学習科目別（空欄）: ${fmtCounts(s.byStudySubject)}`,
    `  年度別:     ${fmtCounts(s.byYear)}`,
  ]
}

export function formatSentakuErrors(errors: SentakuError[]): string[] {
  return errors.map(e => `  #${e.index} ${e.questionId ?? '(question_id なし)'}: ${e.reasons.join(' / ')}`)
}

// 期待する網羅（spec §4 の1）: 10年（H29〜R08）×2科目 = 20問。足りない問IDを返す。
export const SENTAKU_YEARS: readonly string[] = ['H29', 'H30', 'R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08']
export const SENTAKU_EXPECTED_IDS: readonly string[] = SENTAKU_YEARS.flatMap(y => ['RK', 'RS'].map(c => `${y}_S_${c}`))

export function missingQuestionIds(valid: ValidSentaku[]): string[] {
  const have = new Set(valid.map(v => v.questionId))
  return SENTAKU_EXPECTED_IDS.filter(id => !have.has(id))
}
