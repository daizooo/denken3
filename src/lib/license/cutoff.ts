// 足切りダッシュボードと5月末ゲート（licensehub-expansion.md §10.2・PR-I）の集計と判定。純関数。
//
// 採点科目（選択式8・択一7）ごとに次を並べる:
//   - 肢の正答率（直近）: 直近の結果が S・A・B の肢 ÷ 直近の結果がある肢（C は誤答、未着手は数えない）
//   - FSRS の想起確率の平均（想起確率が出る肢だけ）
//   - 本番形式模試の得点（denken_mock_sessions。出る順で既習の肢を含む）と公開模試の得点（lic_external_scores）
//   - 想定得点（推定）: 肢の正答率からの暫定換算。模試で較正するまで参考表示
//   - 足切りラインとの差: 公開模試 → 本番形式模試 → 推定 の順で、ある値を使う
// 集計に入れる肢は law_status='ok' だけ（isLawCleared。§9）。フィクスチャの年度（R98・R99）は既定で除く。
// 閾値は src/data/sharoushi/index.ts の SHAROUSHI_GATE_THRESHOLDS から受け取る（推定値。固定値を埋め込まない）。
import type { LicFormat } from '../../domain/license'
import { parseItemId } from '../../domain/license'
import type { Status } from '../../domain/types'
import { judgeSection, type ScoringModel, type ScoringSection, type SubjectScores } from '../../domain/scoring'
import { isLawCleared } from './lawStatus'
import { FIXTURE_YEARS } from './ingest/schema.ts'

export interface GateThresholds {
  blue: { taku: number; sentaku: number; maxFloorFailures: number }
  yellowFloorFailures: number
  redTakuBelow: number
  generalStudySubjects: readonly string[]
  minAttempted: number
  estimateExponent: number
}

/** lic_items の集計に使う列。 */
export interface CutoffItem {
  id: string
  scored_subject: string
  study_subject: string | null
  law_status: string | null
}

/** 公開模試の得点（lic_external_scores の1行）。式を入力していなければ null。 */
export interface ExternalScore {
  id: string
  label: string
  taken_on: string
  sentaku_scores: SubjectScores | null
  taku_scores: SubjectScores | null
  memo?: string | null
}

/** 本番形式模試の採点確定済みセッション（denken_mock_sessions の一部の列）。 */
export interface FinishedMock {
  subject_id: string          // 'taku' | 'sentaku'
  paper_id: string            // 年度
  finished_at: string | null
  section_scores: SubjectScores | null
}

export type ScoreSourceKind = 'external' | 'mock'

export interface ScoreSource {
  kind: ScoreSourceKind
  label: string               // 公開模試の名前 / 本番形式模試の年度
  date: string                // 受験日（YYYY-MM-DD）
  scores: SubjectScores
}

export interface SubjectRow {
  section: LicFormat
  code: string
  name: string
  maxPoints: number
  floor: number
  items: number               // 集計対象の肢（law_status='ok'）
  attempted: number           // 直近の結果がある肢
  accuracy: number | null     // 肢の正答率（直近）。attempted が 0 なら null
  recallAvg: number | null    // 想起確率の平均
  insufficient: boolean       // データ不足（attempted < minAttempted）
  estimated: number | null    // 想定得点（推定）。データ不足なら null
  mockScore: number | null    // 本番形式模試の得点（既習を含む）
  externalScore: number | null
  basis: ScoreSourceKind | 'estimate' | null   // 足切りラインとの差に使った値
  floorGap: number | null     // basis の値 − 足切り
}

export const SOURCE_LABELS: Record<ScoreSourceKind | 'estimate', string> = {
  external: '公開模試',
  mock: '本番形式模試（既習を含む）',
  estimate: '推定',
}

const CORRECT: ReadonlySet<Status> = new Set<Status>(['S', 'A', 'B'])

/** 肢の正答率から想定得点（推定）に換算する暫定式。択一は1問5肢を正答率^exp、選択式は1空欄＝1肢。 */
export function estimateScore(section: LicFormat, maxPoints: number, accuracy: number, exponent: number): number {
  const p = section === 'taku' ? Math.pow(accuracy, exponent) : accuracy
  return Math.round(maxPoints * p * 10) / 10
}

/** 本番形式模試・公開模試のうち、式ごとに最も新しいもの。 */
export function latestMock(mocks: readonly FinishedMock[], section: LicFormat, excludeYears: readonly string[]): ScoreSource | null {
  const xs = mocks
    .filter(m => m.subject_id === section && m.section_scores && !excludeYears.includes(m.paper_id))
    .sort((a, b) => (a.finished_at ?? '').localeCompare(b.finished_at ?? ''))
  const m = xs[xs.length - 1]
  return m ? { kind: 'mock', label: m.paper_id, date: (m.finished_at ?? '').slice(0, 10), scores: m.section_scores! } : null
}

export function latestExternal(rows: readonly ExternalScore[], section: LicFormat): ScoreSource | null {
  const key = section === 'taku' ? 'taku_scores' : 'sentaku_scores'
  const xs = rows.filter(r => r[key]).sort((a, b) => a.taken_on.localeCompare(b.taken_on))
  const r = xs[xs.length - 1]
  return r ? { kind: 'external', label: r.label, date: r.taken_on, scores: r[key]! } : null
}

/** ゲートの入力元: 公開模試を優先し、無ければ本番形式模試（既習を含む）。 */
export function gateSource(
  externals: readonly ExternalScore[], mocks: readonly FinishedMock[], section: LicFormat, excludeYears: readonly string[],
): ScoreSource | null {
  return latestExternal(externals, section) ?? latestMock(mocks, section, excludeYears)
}

function yearOf(id: string): string | null {
  return parseItemId(id)?.year ?? null
}

export interface CutoffInput {
  model: ScoringModel
  items: readonly CutoffItem[]
  statusOf: (id: string) => Status | undefined
  recallOf: (id: string) => number | null
  externals: readonly ExternalScore[]
  mocks: readonly FinishedMock[]
  thresholds: GateThresholds
  /** 集計から除く年度（既定: フィクスチャの R98・R99）。 */
  excludeYears?: readonly string[]
  /** 学習科目ID → 表示名（判定の理由に使う）。 */
  studyNames?: Record<string, string>
}

/** 集計に入れる肢（law_status='ok'、肢IDとして正しく、除外年度でない）。 */
export function countableItems(items: readonly CutoffItem[], excludeYears: readonly string[] = FIXTURE_YEARS): CutoffItem[] {
  return items.filter(it => {
    if (!isLawCleared(it.law_status)) return false
    const y = yearOf(it.id)
    return y !== null && !excludeYears.includes(y)
  })
}

export function subjectRows(input: CutoffInput): SubjectRow[] {
  const exclude = input.excludeYears ?? FIXTURE_YEARS
  const t = input.thresholds
  const items = countableItems(input.items, exclude)
  const rows: SubjectRow[] = []
  for (const sec of input.model.sections) {
    const ext = latestExternal(input.externals, sec.id)
    const mock = latestMock(input.mocks, sec.id, exclude)
    for (const s of sec.subjects) {
      const mine = items.filter(it => it.scored_subject === s.code && parseItemId(it.id)?.format === sec.id)
      let attempted = 0, correct = 0, recallSum = 0, recallN = 0
      for (const it of mine) {
        const st = input.statusOf(it.id)
        if (st && st !== '未着手') { attempted++; if (CORRECT.has(st)) correct++ }
        const r = input.recallOf(it.id)
        if (r != null) { recallSum += r; recallN++ }
      }
      const accuracy = attempted > 0 ? correct / attempted : null
      const insufficient = attempted < t.minAttempted
      const estimated = !insufficient && accuracy != null ? estimateScore(sec.id, s.maxPoints, accuracy, t.estimateExponent) : null
      const externalScore = ext ? ext.scores[s.code] ?? null : null
      const mockScore = mock ? mock.scores[s.code] ?? null : null
      const basis = externalScore != null ? 'external' : mockScore != null ? 'mock' : estimated != null ? 'estimate' : null
      const value = basis === 'external' ? externalScore : basis === 'mock' ? mockScore : estimated
      rows.push({
        section: sec.id, code: s.code, name: s.name, maxPoints: s.maxPoints, floor: s.floor,
        items: mine.length, attempted, accuracy,
        recallAvg: recallN > 0 ? recallSum / recallN : null,
        insufficient, estimated, mockScore, externalScore, basis,
        floorGap: value != null ? Math.round((value - s.floor) * 10) / 10 : null,
      })
    }
  }
  return rows
}

// ---------------------------------------------------------------------------
// 5月末ゲート（§10.2）。

export type GateVerdict = 'blue' | 'yellow' | 'red' | 'insufficient'

export const GATE_LABELS: Record<GateVerdict, string> = {
  blue: '青（計画どおり）',
  yellow: '黄（6月に再判定）',
  red: '赤（2028年本命を検討）',
  insufficient: 'データ不足',
}

export interface GateResult {
  verdict: GateVerdict
  reasons: string[]
  taku: ScoreSource | null
  sentaku: ScoreSource | null
  takuTotal: number | null
  sentakuTotal: number | null
  floorFailures: { section: LicFormat; code: string }[]
  firstLapDone: boolean
  untouchedGeneral: string[]   // 未着手の一般常識の学習科目
  includesStudied: boolean     // 入力元に本番形式模試（既習を含む）がある
}

function sectionOf(model: ScoringModel, id: LicFormat): ScoringSection | undefined {
  return model.sections.find(s => s.id === id)
}

export function judgeGate(input: CutoffInput): GateResult {
  const exclude = input.excludeYears ?? FIXTURE_YEARS
  const t = input.thresholds
  const items = countableItems(input.items, exclude)
  const attemptedOf = (it: CutoffItem) => { const s = input.statusOf(it.id); return !!s && s !== '未着手' }
  const firstLapDone = items.length > 0 && items.every(attemptedOf)
  const untouchedGeneral = t.generalStudySubjects.filter(ss => !items.some(it => it.study_subject === ss && attemptedOf(it)))

  const taku = gateSource(input.externals, input.mocks, 'taku', exclude)
  const sentaku = gateSource(input.externals, input.mocks, 'sentaku', exclude)
  const floorFailures: GateResult['floorFailures'] = []
  let takuTotal: number | null = null
  let sentakuTotal: number | null = null
  for (const [id, src] of [['taku', taku], ['sentaku', sentaku]] as const) {
    const sec = sectionOf(input.model, id)
    if (!sec || !src) continue
    const j = judgeSection(sec, src.scores)
    if (id === 'taku') takuTotal = j.total
    else sentakuTotal = j.total
    for (const code of j.floorFailures) floorFailures.push({ section: id, code })
  }
  const includesStudied = taku?.kind === 'mock' || sentaku?.kind === 'mock'

  const red: string[] = []
  if (takuTotal != null && takuTotal < t.redTakuBelow) red.push(`択一 ${takuTotal} 点（${t.redTakuBelow} 点未満）`)
  if (!firstLapDone) red.push(items.length === 0 ? '集計できる肢がない（1周目未完了）' : '1周目未完了')
  for (const ss of untouchedGeneral) red.push(`${input.studyNames?.[ss] ?? ss}が未着手`)
  if (floorFailures.length > t.yellowFloorFailures) red.push(`足切り科目 ${floorFailures.length}`)
  const base = { taku, sentaku, takuTotal, sentakuTotal, floorFailures, firstLapDone, untouchedGeneral, includesStudied }
  if (red.length > 0) return { ...base, verdict: 'red', reasons: red }

  if (takuTotal == null) return { ...base, verdict: 'insufficient', reasons: ['択一の得点がない（公開模試か本番形式模試を入力する）'] }
  const yellow: string[] = []
  if (takuTotal < t.blue.taku) yellow.push(`択一 ${takuTotal} 点（${t.redTakuBelow}〜${t.blue.taku - 1}）`)
  if (floorFailures.length === t.yellowFloorFailures) yellow.push(`足切り科目 ${floorFailures.length}`)
  if (yellow.length > 0) return { ...base, verdict: 'yellow', reasons: yellow }
  if (sentakuTotal == null) return { ...base, verdict: 'insufficient', reasons: ['選択式の得点がない（公開模試か本番形式模試を入力する）'] }
  if (sentakuTotal < t.blue.sentaku) return { ...base, verdict: 'yellow', reasons: [`選択式 ${sentakuTotal} 点（${t.blue.sentaku} 点未満）`] }
  return { ...base, verdict: 'blue', reasons: [] }
}

// ---------------------------------------------------------------------------
// 公開模試の得点入力の検証。式ごとに、全科目を空欄にすれば「未入力」（null）、一部だけの入力はエラー。

export function parseSectionScores(
  section: ScoringSection, raw: Record<string, string>,
): { scores: SubjectScores | null; errors: string[] } {
  const filled = section.subjects.filter(s => (raw[s.code] ?? '').trim() !== '')
  if (filled.length === 0) return { scores: null, errors: [] }
  const errors: string[] = []
  const scores: SubjectScores = {}
  for (const s of section.subjects) {
    const v = (raw[s.code] ?? '').trim()
    if (v === '') { errors.push(`${section.name} ${s.name}: 未入力`); continue }
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0 || n > s.maxPoints) { errors.push(`${section.name} ${s.name}: 0〜${s.maxPoints} の整数`); continue }
    scores[s.code] = n
  }
  return errors.length > 0 ? { scores: null, errors } : { scores, errors }
}
