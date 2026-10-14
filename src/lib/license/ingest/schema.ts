// 書き起こしJSON（書籍の一問一答）のスキーマ・検証・DB行への変換（licensehub-expansion.md §4.2・§14・PR-J1a）。
//
// 1肢の例（§14）:
//   { "source_ref": "R03-RK-05-C", "statement": "…", "truth": false,
//     "explanation": "…", "topic": "…", "importance": "A" }
//
// source_ref は本試験の座標 {年度}-{採点科目}-{問(2桁)}-{肢}。肢は ア〜オ / A〜E のどちらでもよく、
// A〜E に正規化して肢ID（{年度}_T_{科目}_{問}_{肢}）を作る。元の表記は label_raw に残す。
// 学習科目（study_subject）は肢ごとに書くか、取り込み単位（--subject）で与える（§14: 取り込みは学習科目単位）。
//
// 検証に失敗した肢は理由つきの一覧にして保存しない（無理に通さない）。
// scripts/license/*.mjs からも Node の型除去で直接読むため、import は拡張子 .ts 付きで書く。
import type { Importance, ItemLabel, LicItemRow, LicQuestionRow } from '../../../domain/license.ts'
import { makeItemId, makeQuestionId, normalizeLabel } from '../../../domain/license.ts'
import { SHAROUSHI_SCORED_TO_STUDY, SHAROUSHI_SCORING, SHAROUSHI_SUBJECTS } from '../../../data/sharoushi/index.ts'

export interface TranscribedItem {
  source_ref: string
  statement: string
  truth: boolean
  explanation?: string | null
  topic?: string | null
  importance?: Importance | null
  study_subject?: string
}

const KNOWN_KEYS = new Set(['source_ref', 'statement', 'truth', 'explanation', 'topic', 'importance', 'study_subject'])

// 検証を通った1肢（DB行へ変換する前の正規形）。
export interface ValidItem {
  index: number            // 入力配列での位置（0始まり）
  sourceRef: string
  itemId: string           // 'R03_T_RK_05_C'
  questionId: string       // 'R03_T_RK_05'
  year: string
  scoredSubject: string
  studySubject: string
  qNo: number
  label: ItemLabel
  labelRaw: string
  statement: string
  truth: boolean
  explanation: string | null
  topic: string | null
  importance: Importance | null
  holdoutGroup: string | null
}

export interface IngestError {
  index: number
  sourceRef: string | null
  reasons: string[]
}

export interface ValidationResult {
  valid: ValidItem[]
  errors: IngestError[]
}

export interface ValidateOptions {
  studySubject?: string   // 肢に study_subject が無いときの既定（取り込み単位の学習科目）
  fixture?: boolean       // true: フィクスチャ年度だけを許す / false: フィクスチャ年度を拒否する
}

// ---------------------------------------------------------------------------
// フィクスチャの識別（§12.2 の3）
//
// フィクスチャは実在しない年度（R98・R99）だけを使う。ID・年度で本物の肢と必ず区別でき、
// 削除スクリプトはこの年度の行だけを消す。本番の取り込みではこの年度を拒否する。

export const FIXTURE_YEARS: readonly string[] = ['R98', 'R99']

export function isFixtureId(id: string): boolean {
  const m = id.match(/^([HR]\d{2})_/)
  return !!m && FIXTURE_YEARS.includes(m[1])
}

// ---------------------------------------------------------------------------
// 温存グループ（§8）。温存は廃止した（R6〜R8 は模試として置き、日々の演習にも出す）ため、常に null。
// lic_questions.holdout_group の列と件数の報告は残す（再び使うときに取り込み経路を変えずに済むように）。

export function holdoutGroupOf(_year: string, _scoredSubject: string): string | null {
  return null
}

// ---------------------------------------------------------------------------
// 座標

const SOURCE_REF_RE = /^([HR]\d{2})-([A-Z]{2})-(\d{2})-(.+)$/

const TAKU = SHAROUSHI_SCORING.sections.find(s => s.id === 'taku')!
// 択一式の科目コード → 問数（1問1点なので maxPoints = 問数）。
const TAKU_QUESTIONS: Record<string, number> = Object.fromEntries(TAKU.subjects.map(s => [s.code, s.maxPoints]))
const STUDY_IDS = new Set(SHAROUSHI_SUBJECTS.map(s => s.id))

export interface SourceRef {
  year: string
  scoredSubject: string
  qNo: number
  labelRaw: string
}

// source_ref を座標に分解する。形式・科目コード・問番号・肢ラベルの誤りは理由の配列で返す。
export function parseSourceRef(ref: string): { ref: SourceRef; label: ItemLabel } | { reasons: string[] } {
  const m = ref.match(SOURCE_REF_RE)
  if (!m) return { reasons: [`source_ref の形式が不正（{年度}-{科目}-{問2桁}-{肢}、例 R03-RK-05-C）: ${ref}`] }
  const [, year, scoredSubject, q, labelRaw] = m
  const reasons: string[] = []
  const qNo = Number(q)
  if (!(scoredSubject in SHAROUSHI_SCORED_TO_STUDY)) {
    reasons.push(`科目コードが未知（§4.3）: ${scoredSubject}`)
  } else if (!(scoredSubject in TAKU_QUESTIONS)) {
    reasons.push(`択一式に無い科目コード（選択式のみ。§4.3）: ${scoredSubject}`)
  } else if (qNo < 1 || qNo > TAKU_QUESTIONS[scoredSubject]) {
    reasons.push(`問番号が範囲外（1〜${TAKU_QUESTIONS[scoredSubject]}）: ${q}`)
  }
  const label = normalizeLabel(labelRaw)
  if (!label) reasons.push(`肢ラベルが不正（ア〜オ / A〜E）: ${labelRaw}`)
  if (reasons.length > 0 || !label) return { reasons }
  return { ref: { year, scoredSubject, qNo, labelRaw }, label }
}

// ---------------------------------------------------------------------------
// 検証

const IMPORTANCES: readonly string[] = ['A', 'B', 'C']

function optionalText(v: unknown, key: string, reasons: string[]): string | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') { reasons.push(`${key} が文字列でない`); return null }
  const s = v.trim()
  return s === '' ? null : s
}

function validateOne(raw: unknown, index: number, opts: ValidateOptions): ValidItem | IngestError {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { index, sourceRef: null, reasons: ['肢がオブジェクトでない'] }
  }
  const o = raw as Record<string, unknown>
  const reasons: string[] = []
  const sourceRef = typeof o.source_ref === 'string' ? o.source_ref.trim() : null

  const unknown = Object.keys(o).filter(k => !KNOWN_KEYS.has(k))
  if (unknown.length > 0) reasons.push(`不明な項目（綴りの誤り？）: ${unknown.join(', ')}`)

  let parsed: { ref: SourceRef; label: ItemLabel } | null = null
  if (!sourceRef) {
    reasons.push('source_ref が無い・空')
  } else {
    const r = parseSourceRef(sourceRef)
    if ('reasons' in r) reasons.push(...r.reasons)
    else parsed = r
  }

  if (parsed) {
    const isFixtureYear = FIXTURE_YEARS.includes(parsed.ref.year)
    if (opts.fixture && !isFixtureYear) {
      reasons.push(`フィクスチャの取り込みでは年度は ${FIXTURE_YEARS.join('/')} のみ: ${parsed.ref.year}`)
    } else if (!opts.fixture && isFixtureYear) {
      reasons.push(`フィクスチャ専用の年度（--fixture を付けて取り込む）: ${parsed.ref.year}`)
    }
  }

  let statement = ''
  if (typeof o.statement !== 'string') reasons.push('statement が無い・文字列でない')
  else if (o.statement.trim() === '') reasons.push('statement（本文）が空')
  else statement = o.statement.trim()

  if (typeof o.truth !== 'boolean') reasons.push(`truth が true/false でない: ${JSON.stringify(o.truth)}`)

  const explanation = optionalText(o.explanation, 'explanation', reasons)
  const topic = optionalText(o.topic, 'topic', reasons)

  let importance: Importance | null = null
  if (o.importance !== undefined && o.importance !== null) {
    if (typeof o.importance === 'string' && IMPORTANCES.includes(o.importance)) importance = o.importance as Importance
    else reasons.push(`importance は A/B/C: ${JSON.stringify(o.importance)}`)
  }

  const studyRaw = o.study_subject !== undefined ? o.study_subject : opts.studySubject
  let studySubject = ''
  if (typeof studyRaw !== 'string' || studyRaw === '') {
    reasons.push('study_subject が無い（肢に書くか --subject で指定する）')
  } else if (!STUDY_IDS.has(studyRaw)) {
    reasons.push(`学習科目が未知: ${studyRaw}`)
  } else {
    studySubject = studyRaw
    if (parsed && !SHAROUSHI_SCORED_TO_STUDY[parsed.ref.scoredSubject]?.includes(studyRaw)) {
      reasons.push(`学習科目 ${studyRaw} は採点科目 ${parsed.ref.scoredSubject} に含まれない（§4.3）`)
    }
  }

  if (reasons.length > 0 || !parsed) return { index, sourceRef, reasons }

  const { ref, label } = parsed
  const coord = { year: ref.year, format: 'taku' as const, scoredSubject: ref.scoredSubject, qNo: ref.qNo }
  return {
    index,
    sourceRef: sourceRef!,
    itemId: makeItemId({ ...coord, label }),
    questionId: makeQuestionId(coord),
    year: ref.year,
    scoredSubject: ref.scoredSubject,
    studySubject,
    qNo: ref.qNo,
    label,
    labelRaw: ref.labelRaw,
    statement,
    truth: o.truth as boolean,
    explanation,
    topic,
    importance,
    holdoutGroup: holdoutGroupOf(ref.year, ref.scoredSubject),
  }
}

// 書き起こしJSON（肢の配列）を検証する。1肢ずつの検証に加えて、
// 肢IDの重複と、同じ問の肢どうしで学習科目が食い違うものを失敗にする（どちらが正しいか決められないため、該当の全肢）。
export function validateTranscription(input: unknown, opts: ValidateOptions = {}): ValidationResult {
  if (!Array.isArray(input)) {
    return { valid: [], errors: [{ index: -1, sourceRef: null, reasons: ['JSON の最上位が肢の配列でない'] }] }
  }
  const results = input.map((raw, i) => validateOne(raw, i, opts))
  const ok = results.filter((r): r is ValidItem => 'itemId' in r)
  const errors = results.filter((r): r is IngestError => !('itemId' in r))

  const extra = new Map<number, string[]>()
  const addExtra = (i: number, reason: string) => extra.set(i, [...(extra.get(i) ?? []), reason])

  const byItem = new Map<string, ValidItem[]>()
  for (const v of ok) byItem.set(v.itemId, [...(byItem.get(v.itemId) ?? []), v])
  for (const [id, vs] of byItem) {
    if (vs.length < 2) continue
    const at = vs.map(v => `#${v.index}`).join(', ')
    for (const v of vs) addExtra(v.index, `肢IDが重複: ${id}（${at}）`)
  }

  const byQuestion = new Map<string, ValidItem[]>()
  for (const v of ok) byQuestion.set(v.questionId, [...(byQuestion.get(v.questionId) ?? []), v])
  for (const [qid, vs] of byQuestion) {
    const subjects = [...new Set(vs.map(v => v.studySubject))]
    if (subjects.length < 2) continue
    for (const v of vs) addExtra(v.index, `同じ問 ${qid} の肢で学習科目が食い違う: ${subjects.join(' / ')}`)
  }

  const valid = ok.filter(v => !extra.has(v.index))
  const allErrors = [
    ...errors,
    ...ok.filter(v => extra.has(v.index)).map(v => ({ index: v.index, sourceRef: v.sourceRef, reasons: extra.get(v.index)! })),
  ].sort((a, b) => a.index - b.index)
  return { valid, errors: allErrors }
}

// ---------------------------------------------------------------------------
// DB 行への変換
//
// lic_items は origin_statement・updated_at を送らない（公式PDF（PR-D）が入れた原文を上書きしないため）。
// lic_questions は問が既にあれば触らない（ignoreDuplicates。公式PDFの stem・answer_spec を守る）。

export type IngestQuestionRow = Omit<LicQuestionRow, 'updated_at'>
export type IngestItemRow = Omit<LicItemRow, 'origin_statement' | 'updated_at'>

export function toRows(valid: ValidItem[], userId: string): { questions: IngestQuestionRow[]; items: IngestItemRow[] } {
  const questions = new Map<string, IngestQuestionRow>()
  const items: IngestItemRow[] = []
  for (const v of valid) {
    if (!questions.has(v.questionId)) {
      questions.set(v.questionId, {
        user_id: userId,
        id: v.questionId,
        year: v.year,
        format: 'taku',
        scored_subject: v.scoredSubject,
        study_subject: v.studySubject,
        q_no: v.qNo,
        stem: null,
        answer_spec: null,
        source: 'ippon',
        holdout_group: v.holdoutGroup,
      })
    }
    items.push({
      user_id: userId,
      id: v.itemId,
      question_id: v.questionId,
      label: v.label,
      label_raw: v.labelRaw,
      statement: v.statement,
      truth: v.truth,
      truth_source: 'book',
      explanation: v.explanation,
      explanation_source: v.explanation ? 'book' : 'none',
      explanation_verified: !!v.explanation,
      topic_id: v.topic,
      importance: v.importance,
      law_status: 'ok',   // 書籍（2027年版）は出版社の補正基準を信頼する（§9）
      law_note: null,
      study_subject: v.studySubject,
      scored_subject: v.scoredSubject,
    })
  }
  return { questions: [...questions.values()], items }
}

// ---------------------------------------------------------------------------
// 件数の報告（§14: 取り込みのたびに科目別・年度別・温存対象の件数を出す）

export interface IngestSummary {
  items: number
  questions: number
  byStudySubject: Record<string, number>
  byYear: Record<string, number>
  byHoldout: Record<string, number>
  withoutExplanation: number
  withoutTopic: number
  withoutImportance: number
}

const countBy = <T>(xs: T[], key: (x: T) => string): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const x of xs) out[key(x)] = (out[key(x)] ?? 0) + 1
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}

export function summarize(valid: ValidItem[]): IngestSummary {
  return {
    items: valid.length,
    questions: new Set(valid.map(v => v.questionId)).size,
    byStudySubject: countBy(valid, v => v.studySubject),
    byYear: countBy(valid, v => v.year),
    byHoldout: countBy(valid.filter(v => v.holdoutGroup), v => v.holdoutGroup!),
    withoutExplanation: valid.filter(v => !v.explanation).length,
    withoutTopic: valid.filter(v => !v.topic).length,
    withoutImportance: valid.filter(v => !v.importance).length,
  }
}

const fmtCounts = (r: Record<string, number>) =>
  Object.keys(r).length === 0 ? '0' : Object.entries(r).map(([k, n]) => `${k} ${n}`).join(' / ')

export function formatSummary(s: IngestSummary): string[] {
  const holdoutTotal = Object.values(s.byHoldout).reduce((a, b) => a + b, 0)
  return [
    `肢 ${s.items} 件（問 ${s.questions} 件）`,
    `  学習科目別: ${fmtCounts(s.byStudySubject)}`,
    `  年度別:     ${fmtCounts(s.byYear)}`,
    `  温存対象:   ${holdoutTotal} 件${holdoutTotal > 0 ? `（${fmtCounts(s.byHoldout)}）※解放日まで出題しない分、周回の出題数が減る` : ''}`,
    `  解説なし ${s.withoutExplanation} / 論点なし ${s.withoutTopic} / 重要度なし ${s.withoutImportance}`,
  ]
}

export function formatErrors(errors: IngestError[]): string[] {
  return errors.map(e => `  #${e.index} ${e.sourceRef ?? '(source_ref なし)'}: ${e.reasons.join(' / ')}`)
}
