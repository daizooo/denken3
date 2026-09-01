// 1問あたりの所要時間の推定（study-time-scarcity.md 課題1・提案A）。
// 計画の単位を「問題数」から「分」へ移すための土台。すべて純関数で、DB・UI に依存しない。
//
// 推定の優先順（設計書 §3 課題1・提案A）:
//   ① その問題自身の直近の実測（review_history の duration_seconds）
//   ② 同じ「難易度 × studyMode」の実測中央値（母数が足りなければ難易度のみの中央値）
//   ③ 既定値 × ステータス係数（実測が1件も無いときだけ）
//
// 外れ値は記録側と同じ基準でクリップする（timer.ts の durationCapSeconds・課題13）。
// 上限が30分だった時期のデータには中断（画面を消さずに端末を置くと visibilitychange が
// 発火しない）が混ざっているため、そのまま中央値に入れると見積もりが上振れする。
//
// 見積もりが過大に振れても「予算に入る問題が減る＝早く終わる」という安全側に倒れるので、
// 精緻な補正は入れない（設計書 §3 課題1）。

import type { Chapter, MasterQuestion, Review, Status, StudyMode } from '../domain/types'
import { MAX_DURATION_SECONDS, durationCapSeconds } from './timer'

// studyMode 未設定（機械・電力・法規や未分類の理論）は 'unset' に集約する。
export type EstimateModeKey = StudyMode | 'unset'
type Difficulty = 1 | 2 | 3

const BANDS: Difficulty[] = [1, 2, 3]
const MODE_KEYS: EstimateModeKey[] = ['calc', 'memory', 'unset']

// 既定の所要秒（設計書 §6-6 の決定事項。2026-09-01 の実測に基づく）。
//   難易度1: calc 2分 / memory 1.5分、難易度2: calc 5.5分 / memory 2.5分、難易度3: calc 9分 / memory 3分
// studyMode 未設定は両者の平均を使う。
const DEFAULT_SECONDS: Record<Difficulty, Record<StudyMode, number>> = {
  1: { calc: 120, memory: 90 },
  2: { calc: 330, memory: 150 },
  3: { calc: 540, memory: 180 },
}

// ステータス係数（未着手・C: 1.0 / B: 0.7 / A・S: 0.5）。
// **既定値にのみ**掛ける。実測値には計測時点の理解度が既に反映されているため、二重に補正しない。
const STATUS_FACTOR: Record<Status, number> = { '未着手': 1, C: 1, B: 0.7, A: 0.5, S: 0.5 }

// 中央値を採用する最小の母数。これ未満はひとつ上のフォールバックへ落とす。
// 難易度3は該当12問・計測数が少なく安定した中央値が出ない（設計書 §3.0）ため、
// 少数の実測に引きずられないようにする。
const MIN_SAMPLES = 5

export interface TimeStats {
  // 「難易度 × studyMode」の実測中央値（秒）。母数不足は null。
  byModeBand: Record<Difficulty, Record<EstimateModeKey, number | null>>
  // 難易度のみの実測中央値（秒）。母数不足は null。
  byBand: Record<Difficulty, number | null>
  // 問題ID → その問題自身の直近の実測秒（クリップ後）。
  measured: Record<string, number>
  measuredN: number
}

// review_history の末尾から、最後に計測できた解答時間を拾う。
function latestDurationSeconds(r: Review | undefined): number | undefined {
  const h = r?.review_history ?? []
  for (let i = h.length - 1; i >= 0; i--) {
    const s = h[i].duration_seconds
    if (typeof s === 'number' && s > 0) return s
  }
  return undefined
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function medianIfEnough(values: number[]): number | null {
  return values.length >= MIN_SAMPLES ? median(values) : null
}

// 実測値の集計。難易度帯ごとの上限は「粗い中央値の3倍と15分の小さいほう」で、
// 記録側（timer.ts）と同じ durationCapSeconds を使う。
// 上限そのものが中央値に依存するため、粗い中央値 → 上限 → 本番の中央値、の2パスで求める。
export function buildTimeStats(
  chapters: Chapter[],
  reviews: Record<string, Review>,
): TimeStats {
  interface Sample { id: string; band: Difficulty; mode: EstimateModeKey; seconds: number }
  const raw: Sample[] = []

  for (const c of chapters) {
    for (const q of c.questions) {
      const seconds = latestDurationSeconds(reviews[q.id])
      // 旧データには30分上限で記録されたものがある。まず現在の絶対上限で足切りする。
      if (seconds === undefined || seconds > MAX_DURATION_SECONDS) continue
      raw.push({ id: q.id, band: q.difficulty, mode: q.studyMode ?? 'unset', seconds })
    }
  }

  // 1パス目: 難易度帯の粗い中央値からクリップ上限を決める。
  const cap = {} as Record<Difficulty, number>
  for (const b of BANDS) {
    cap[b] = durationCapSeconds(median(raw.filter(s => s.band === b).map(s => s.seconds)))
  }
  const kept = raw.filter(s => s.seconds <= cap[s.band])

  // 2パス目: クリップ後の中央値。
  const byBand = {} as Record<Difficulty, number | null>
  const byModeBand = {} as Record<Difficulty, Record<EstimateModeKey, number | null>>
  for (const b of BANDS) {
    const inBand = kept.filter(s => s.band === b)
    byBand[b] = medianIfEnough(inBand.map(s => s.seconds))
    const row = {} as Record<EstimateModeKey, number | null>
    for (const m of MODE_KEYS) {
      row[m] = medianIfEnough(inBand.filter(s => s.mode === m).map(s => s.seconds))
    }
    byModeBand[b] = row
  }

  const measured: Record<string, number> = {}
  for (const s of kept) measured[s.id] = s.seconds

  return { byModeBand, byBand, measured, measuredN: kept.length }
}

// 実測が1件も無いときに使う既定値（ステータス係数込み）。
function defaultSeconds(q: MasterQuestion, status: Status): number {
  const d = DEFAULT_SECONDS[q.difficulty]
  const base = q.studyMode ? d[q.studyMode] : (d.calc + d.memory) / 2
  return base * STATUS_FACTOR[status]
}

// 1問の推定所要秒。優先順は本ファイル冒頭のとおり。
export function estimateSeconds(
  q: MasterQuestion,
  review: Review | undefined,
  stats: TimeStats,
): number {
  const own = stats.measured[q.id]
  if (own !== undefined) return own
  const byMode = stats.byModeBand[q.difficulty]?.[q.studyMode ?? 'unset']
  if (byMode != null) return byMode
  const byBand = stats.byBand[q.difficulty]
  if (byBand != null) return byBand
  return defaultSeconds(q, review?.status ?? '未着手')
}

// 1問の推定所要分（小数のまま返す。丸めは表示側で行う）。
export function estimateMinutes(
  q: MasterQuestion,
  review: Review | undefined,
  stats: TimeStats,
): number {
  return estimateSeconds(q, review, stats) / 60
}

// 問題集合の推定所要分の合計。
export function sumEstimateMinutes(
  questions: MasterQuestion[],
  reviews: Record<string, Review>,
  stats: TimeStats,
): number {
  return questions.reduce((sum, q) => sum + estimateMinutes(q, reviews[q.id], stats), 0)
}

// 「およそ◯分」の表示。1分未満は「1分未満」に丸める（0分と出さない）。
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0分'
  if (minutes < 1) return '1分未満'
  return `${Math.round(minutes)}分`
}

export interface BudgetPlan {
  count: number         // 予算に収まる問題数（1問も入らない場合でも先頭1問は入れる）
  minutes: number       // その問題数ぶんの推定所要分
  totalMinutes: number  // キュー全体の推定所要分
  fitsAll: boolean      // 予算内にキュー全体が収まるか
}

// 予算（分）に対して「ここまで」の線を引く位置を求める。
// 累積の推定所要が予算を超えた時点で打ち切る。ただし先頭の1問は必ず含める
// （5分の予算に対して先頭が5.5分の計算問題でも「今日は何もできない」とは出さない）。
export function planByBudget(
  questions: MasterQuestion[],
  reviews: Record<string, Review>,
  stats: TimeStats,
  budgetMinutes: number,
): BudgetPlan {
  let count = 0
  let minutes = 0
  let totalMinutes = 0
  let filling = true
  for (const q of questions) {
    const m = estimateMinutes(q, reviews[q.id], stats)
    totalMinutes += m
    if (filling && (count === 0 || minutes + m <= budgetMinutes)) {
      count++
      minutes += m
    } else {
      filling = false
    }
  }
  return { count, minutes, totalMinutes, fitsAll: count >= questions.length }
}

// 「価値 ÷ 推定所要分」＝ 単位時間あたりの期待得点の伸び（設計書 §3 課題1・提案B）。
// 時間が希少なときの最適な貪欲順は価値そのものではなくこの密度になる。
export function valueDensity(valueScore: number, minutes: number): number {
  return valueScore / Math.max(minutes, 0.25)
}
