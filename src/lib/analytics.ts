// 総合分析（§7.7）。Phase 1 で時間データに依存しない (2) 弱点ランキング・(3) 学習曲線を、
// Phase 2b で解答時間を使う (1) 4象限マトリクス・(4) 本番想定得点の推定を追加する。
//
// すべて純関数。母数（対象問題数）を必ず持たせ、計測前・未着手データは自然に除外する。

import type { Chapter, MasterQuestion, MockSession, Review, Status } from '../domain/types'

// 弱点スコアの重み（初期値・使用感で調整）。時間超過率(w3)は Phase 1 では未使用。
const W_INCORRECT = 0.5  // (1 - 直近正答率)
const W_LAPSE = 0.3      // lapse率（取りこぼし）
const W_IMPORTANCE = 0.2 // 重要度加重

export interface ChapterWeakness {
  code: string
  name: string
  attempted: number        // 着手済み（母数）
  total: number
  correctRate: number      // 直近A評価の割合（0..1）
  lapseRate: number        // lapse を経験した問題の割合（0..1）
  importanceWeight: number // 平均重要度の正規化（0..1）
  score: number            // 弱点スコア（0..1）。大きいほど弱い
  advice: string
}

function isCorrect(status: Status | undefined): boolean {
  // S（完璧に理解・復習不要）は A 以上の習得とみなす。
  return status === 'A' || status === 'S'
}

// 章別の弱点スコアランキング（§7.7(2)）。着手済み問題が1問以上ある章のみ対象。
export function chapterWeaknessRanking(
  chapters: Chapter[],
  reviews: Record<string, Review>,
): ChapterWeakness[] {
  const rows: ChapterWeakness[] = []

  for (const c of chapters) {
    const attemptedQs = c.questions.filter(q => {
      const r = reviews[q.id]
      return r && r.status !== '未着手'
    })
    const attempted = attemptedQs.length
    if (attempted === 0) continue

    const correct = attemptedQs.filter(q => isCorrect(reviews[q.id]?.status)).length
    const lapsed = attemptedQs.filter(q => (reviews[q.id]?.lapses ?? 0) > 0).length
    const correctRate = correct / attempted
    const lapseRate = lapsed / attempted

    // 重要度: 未指定は 2（中央）とみなす。平均を (1..3)→(0..1) に正規化。
    const avgImportance =
      attemptedQs.reduce((s, q) => s + (q.importance ?? 2), 0) / attempted
    const importanceWeight = (avgImportance - 1) / 2

    const score =
      W_INCORRECT * (1 - correctRate) +
      W_LAPSE * lapseRate +
      W_IMPORTANCE * importanceWeight

    rows.push({
      code: c.code,
      name: c.name,
      attempted,
      total: c.questions.length,
      correctRate,
      lapseRate,
      importanceWeight,
      score,
      advice: adviceFor(correctRate, lapseRate),
    })
  }

  return rows.sort((a, b) => b.score - a.score)
}

// 支配的な要因から推奨アクション文を生成する。
function adviceFor(correctRate: number, lapseRate: number): string {
  if (correctRate < 0.5) return '正答率が低い — 解法・基礎の再確認'
  if (lapseRate >= 0.4) return '取りこぼし多発 — 反復と解説戻り'
  if (correctRate < 0.8) return 'あと一歩 — 誤答パターンの整理'
  return '安定 — 復習間隔を伸ばして維持'
}

// ---- 学習曲線（§7.7(3)・時間なし版）----

export interface WeeklyLearningPoint {
  week: string        // 週の開始日（月曜）"M/D"
  weekKey: string     // ソート用 "YYYY-MM-DD"
  freshRate: number | null   // 初見の正答率（0..1）。データ無しは null
  freshN: number
  reviewRate: number | null  // 復習の正答率（0..1）
  reviewN: number
}

// "YYYY-MM-DD" の属する週（月曜始まり）の開始日を返す。
function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  const dow = d.getUTCDay() // 0=日..6=土
  const back = (dow + 6) % 7 // 月曜までの戻し日数
  d.setUTCDate(d.getUTCDate() - back)
  return d.toISOString().slice(0, 10)
}

// 週次の正答率トレンド（初見/復習別）。
// review_history の各エントリを走査し、最初のエントリ=初見、以降=復習として集計する。
export function weeklyLearningCurve(reviews: Record<string, Review>): WeeklyLearningPoint[] {
  interface Bucket { freshOk: number; freshN: number; revOk: number; revN: number }
  const buckets = new Map<string, Bucket>()

  for (const r of Object.values(reviews)) {
    const history = [...(r.review_history ?? [])].sort((a, b) => a.date.localeCompare(b.date))
    history.forEach((e, idx) => {
      if (e.status === '未着手') return
      const wk = weekStart(e.date)
      const b = buckets.get(wk) ?? { freshOk: 0, freshN: 0, revOk: 0, revN: 0 }
      const ok = e.status === 'A' || e.status === 'S' ? 1 : 0
      if (idx === 0) { b.freshN++; b.freshOk += ok }
      else { b.revN++; b.revOk += ok }
      buckets.set(wk, b)
    })
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([wk, b]) => ({
      week: `${parseInt(wk.split('-')[1])}/${parseInt(wk.split('-')[2])}`,
      weekKey: wk,
      freshRate: b.freshN > 0 ? b.freshOk / b.freshN : null,
      freshN: b.freshN,
      reviewRate: b.revN > 0 ? b.revOk / b.revN : null,
      reviewN: b.revN,
    }))
}

// ---- (1) 理解度×時間の4象限マトリクス（§7.7(1)）----
// 各問題を「直近の理解度（正答=A / 不正解=B・C）」×「解答時間（同難易度帯の中央値比で
// 速い/遅い）」で4象限に分類する。「A評価だが遅い」＝本番の失点要因を可視化するのが狙い。
// 解答時間の計測値（duration_seconds）がある着手済み問題のみを母数にする。

export interface QuadrantItem {
  id: string
  chapter: string
  number: number
  title: string
  status: Status           // 直近理解度
  seconds: number          // 直近の計測解答時間
  ratio: number            // seconds / 同難易度帯の中央値（>1 で遅い）
  difficulty: 1 | 2 | 3
}

export interface QuadrantMatrix {
  measuredN: number                        // 計測データがある着手済み問題数（母数）
  attemptedN: number                       // 着手済み総数（計測なし含む）
  medians: Record<1 | 2 | 3, number | null> // 難易度帯ごとの中央値秒（母数不足は null）
  stable: QuadrantItem[]      // A・速い     … 安定（復習間隔を伸ばす）
  overtime: QuadrantItem[]    // A・遅い     … 時間超過（スピード訓練対象）
  hasty: QuadrantItem[]       // B/C・速い   … 早とちり・知識穴（解法確認）
  priority: QuadrantItem[]    // B/C・遅い   … 最優先弱点（解説・SAT戻り）
}

// review_history の末尾から、最後に計測できた解答時間を拾う。
function latestMeasuredSeconds(r: Review): number | undefined {
  const h = r.review_history ?? []
  for (let i = h.length - 1; i >= 0; i--) {
    if (typeof h[i].duration_seconds === 'number') return h[i].duration_seconds
  }
  return undefined
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function quadrantMatrix(
  chapters: Chapter[],
  reviews: Record<string, Review>,
): QuadrantMatrix {
  interface M { q: MasterQuestion; chapter: string; status: Status; seconds: number }
  const measured: M[] = []
  let attemptedN = 0

  for (const c of chapters) {
    for (const q of c.questions) {
      const r = reviews[q.id]
      if (!r || r.status === '未着手') continue
      attemptedN++
      const seconds = latestMeasuredSeconds(r)
      if (seconds === undefined) continue
      measured.push({ q, chapter: c.name, status: r.status, seconds })
    }
  }

  // 難易度帯ごとの中央値。
  const byBand: Record<1 | 2 | 3, number[]> = { 1: [], 2: [], 3: [] }
  for (const m of measured) byBand[m.q.difficulty].push(m.seconds)
  const medians = { 1: median(byBand[1]), 2: median(byBand[2]), 3: median(byBand[3]) }

  const matrix: QuadrantMatrix = {
    measuredN: measured.length, attemptedN, medians,
    stable: [], overtime: [], hasty: [], priority: [],
  }

  for (const m of measured) {
    const med = medians[m.q.difficulty]
    const ratio = med && med > 0 ? m.seconds / med : 1
    const slow = ratio > 1 // 中央値超で「遅い」
    const correct = m.status === 'A' || m.status === 'S'
    const item: QuadrantItem = {
      id: m.q.id, chapter: m.chapter, number: m.q.number, title: m.q.title,
      status: m.status, seconds: m.seconds, ratio, difficulty: m.q.difficulty,
    }
    if (correct && !slow) matrix.stable.push(item)
    else if (correct && slow) matrix.overtime.push(item)
    else if (!correct && !slow) matrix.hasty.push(item)
    else matrix.priority.push(item)
  }

  // 各象限は「遅い/優先」ほど上に来るよう ratio 降順。
  const byRatio = (a: QuadrantItem, b: QuadrantItem) => b.ratio - a.ratio
  matrix.stable.sort(byRatio); matrix.overtime.sort(byRatio)
  matrix.hasty.sort(byRatio); matrix.priority.sort(byRatio)
  return matrix
}

// ---- (4) 本番想定得点の推定（§7.7(4)）----
// 分野別の直近理解度（A/B/C）を各問の正答確率に写像し、章を出題比率で加重して
// 「現時点で本番を受けた場合の期待得点」を推定する。年度別の実測スコアがあれば併記して
// 乖離を示す。合格ラインまでの得点インパクトが大きい章を提示する。
//
// 出題比率は本来 年度別データの topic 集計から導くが（§7.7(4)）、未収録の間は
// オーム社原本の問題数（totalCount）を出題比率の代理とする。収録後に差し替える。

// 5択のため未学習（未着手・未収録分）は当て推量の 0.2 をベースラインにする。
// S（完璧に理解・復習不要）は A と同等の正答確率とみなす（インパクトの上限 PROB.A を超えないよう合わせる）。
const PROB: Record<Status, number> = { S: 0.92, A: 0.92, B: 0.6, C: 0.25, '未着手': 0.2 }
const BASELINE = 0.2

export interface ChapterImpact {
  code: string
  name: string
  expectedRate: number   // 章の期待正答率（0..1）
  weight: number         // 出題比率（0..1）
  studiedRatio: number   // 章内の着手済み割合（推定の確度目安）
  impact: number         // この章を全問A相当まで上げたときの総得点への寄与（点）
}

export interface ScoreEstimate {
  hasData: boolean
  estimate: number       // 想定得点（0..100）
  passingGap: number     // passingScore - estimate（正なら不足点）
  studiedRatio: number   // 全体の着手済み割合（原本問題数ベース）
  passingScore: number
  chapters: ChapterImpact[]  // impact 降順
  actual: number | null      // 直近CBT実測（あれば）
  gap: number | null         // actual - estimate
}

export function estimateScore(
  chapters: Chapter[],
  reviews: Record<string, Review>,
  sessions: MockSession[] = [],
  passingScore = 60,
): ScoreEstimate {
  // 出題比率の分母（原本問題数の総和）。0 なら推定不可。
  const totalWeightBase = chapters.reduce((s, c) => s + Math.max(c.totalCount, c.questions.length), 0)
  if (totalWeightBase === 0) {
    return { hasData: false, estimate: 0, passingGap: passingScore, studiedRatio: 0, passingScore, chapters: [], actual: null, gap: null }
  }

  let estimate = 0
  let studiedNum = 0
  const rows: ChapterImpact[] = []

  for (const c of chapters) {
    const denom = Math.max(c.totalCount, c.questions.length) // 原本問題数（捨て問等の未収録分も母数に含める）
    const weight = denom / totalWeightBase
    // 収録済み問題は理解度確率、未収録分（denom - 収録数）はベースライン。
    let probSum = 0
    let attempted = 0
    for (const q of c.questions) {
      const st = reviews[q.id]?.status ?? '未着手'
      if (st !== '未着手') attempted++
      probSum += PROB[st]
    }
    const unknown = Math.max(0, denom - c.questions.length)
    probSum += unknown * BASELINE
    const expectedRate = probSum / denom
    estimate += weight * expectedRate
    studiedNum += attempted
    // インパクト: この章を全問A（0.92）まで引き上げたときの総得点増分。
    const impact = weight * (PROB.A - expectedRate) * 100
    rows.push({ code: c.code, name: c.name, expectedRate, weight, studiedRatio: c.questions.length ? attempted / c.questions.length : 0, impact })
  }

  estimate = Math.round(estimate * 100)
  rows.sort((a, b) => b.impact - a.impact)

  // 実測（直近の finished・cbt スコア）。
  const finished = sessions
    .filter(s => s.status === 'finished' && s.mode === 'cbt' && s.score != null && s.finished_at)
    .sort((a, b) => (b.finished_at! < a.finished_at! ? -1 : 1))
  const actual = finished.length ? (finished[0].score as number) : null

  return {
    hasData: studiedNum > 0,
    estimate,
    passingGap: passingScore - estimate,
    studiedRatio: studiedNum / totalWeightBase,
    passingScore,
    chapters: rows,
    actual,
    gap: actual != null ? actual - estimate : null,
  }
}
