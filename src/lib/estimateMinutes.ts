// 1問あたりの所要時間の推定（study-time-scarcity.md 課題1・提案A）。
// 計画の単位を「問題数」から「分」へ移すための土台。すべて純関数で、DB・UI に依存しない。
//
// 社労士の「1問」は、択一式の肢（1つの文の○×）か、選択式の空欄（語群から1語）。
// 所要時間はこの形式（TimeKind）で決まるので、実測の集計も既定値も形式ごとに持つ。
//
// 推定の優先順（設計書 §3 課題1・提案A）:
//   ① その問題自身の直近の実測（review_history の duration_seconds）
//   ② 同じ形式の実測中央値（母数が MIN_SAMPLES 未満なら使わない）
//   ③ 既定値 × ステータス係数（実測が1件も無いときだけ）
//
// 外れ値は記録側と同じ基準でクリップする（timer.ts の durationCapSeconds・課題13）。
// 上限が30分だった時期のデータには中断（画面を消さずに端末を置くと visibilitychange が
// 発火しない）が混ざっているため、そのまま中央値に入れると見積もりが上振れする。
//
// 見積もりが過大に振れても「予算に入る問題が減る＝早く終わる」という安全側に倒れるので、
// 精緻な補正は入れない（設計書 §3 課題1）。

import { parseItemId, type LicFormat } from '../domain/license'
import type { Chapter, MasterQuestion, Review, Status, StudyMode } from '../domain/types'
import { MAX_DURATION_SECONDS, durationCapSeconds } from './timer'

// 再スケジュールの目標保持率（policy.ts）が参照する、問題の学習形態キー。未設定は 'unset'。
export type EstimateModeKey = StudyMode | 'unset'

// 所要時間を分ける単位。択一式の肢（taku）と、選択式の空欄（sentaku）。
export type TimeKind = LicFormat
const KINDS: TimeKind[] = ['taku', 'sentaku']

// 問題ID（肢ID・空欄ID）から形式を引く。読めないIDは、数の多い択一式の肢として扱う。
export function timeKindOf(id: string): TimeKind {
  return parseItemId(id)?.format ?? 'taku'
}

// 既定の所要秒。実測が貯まるまでの仮値で、licensehub-expansion.md §12.1 の見込みに合わせてある。
//   択一式の肢: 60〜120秒の中央 = 90秒（400肢 ≒ 6.7〜13.3時間という試算の前提）
//   選択式の空欄: 40空欄 ≒ 1.3時間 = 約120秒（問題文を読んで語群20語から選ぶので肢より長い）
// 実測がある問題・形式（MIN_SAMPLES 件以上）では使われない。
const DEFAULT_SECONDS: Record<TimeKind, number> = {
  taku: 90,
  sentaku: 120,
}

// ステータス係数（未着手・C: 1.0 / B: 0.7 / A・S: 0.5）。
// **既定値にのみ**掛ける。実測値には計測時点の理解度が既に反映されているため、二重に補正しない。
const STATUS_FACTOR: Record<Status, number> = { '未着手': 1, C: 1, B: 0.7, A: 0.5, S: 0.5 }

// 中央値を採用する最小の母数。これ未満は既定値へ落とす。
// 少数の実測に引きずられて、見積もりが大きく振れないようにする。
const MIN_SAMPLES = 5

export interface TimeStats {
  // 形式ごとの実測中央値（秒）。母数不足は null。
  byKind: Record<TimeKind, number | null>
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

// 実測値の集計。形式ごとの上限は「粗い中央値の3倍と MAX_DURATION_SECONDS の小さいほう」で、
// 記録側（timer.ts）と同じ durationCapSeconds を使う。
// 上限そのものが中央値に依存するため、粗い中央値 → 上限 → 本番の中央値、の2パスで求める。
export function buildTimeStats(
  chapters: Chapter[],
  reviews: Record<string, Review>,
): TimeStats {
  interface Sample { id: string; kind: TimeKind; seconds: number }
  const raw: Sample[] = []

  for (const c of chapters) {
    for (const q of c.questions) {
      const seconds = latestDurationSeconds(reviews[q.id])
      // 旧データには上限が今より長かった頃に記録されたものがある。まず現在の絶対上限で足切りする。
      if (seconds === undefined || seconds > MAX_DURATION_SECONDS) continue
      raw.push({ id: q.id, kind: timeKindOf(q.id), seconds })
    }
  }

  // 1パス目: 形式ごとの粗い中央値からクリップ上限を決める。
  const cap = {} as Record<TimeKind, number>
  for (const k of KINDS) {
    cap[k] = durationCapSeconds(median(raw.filter(s => s.kind === k).map(s => s.seconds)))
  }
  const kept = raw.filter(s => s.seconds <= cap[s.kind])

  // 2パス目: クリップ後の中央値。
  const byKind = {} as Record<TimeKind, number | null>
  for (const k of KINDS) {
    byKind[k] = medianIfEnough(kept.filter(s => s.kind === k).map(s => s.seconds))
  }

  const measured: Record<string, number> = {}
  for (const s of kept) measured[s.id] = s.seconds

  return { byKind, measured, measuredN: kept.length }
}

// 形式ごとの既定所要秒（**ステータス係数を掛ける前**の素の値）。
export function baselineSeconds(q: Pick<MasterQuestion, 'id'>): number {
  return DEFAULT_SECONDS[timeKindOf(q.id)]
}

// 実測が1件も無いときに使う既定値（ステータス係数込み）。
function defaultSeconds(q: MasterQuestion, status: Status): number {
  return baselineSeconds(q) * STATUS_FACTOR[status]
}

// 1問の推定所要秒。優先順は本ファイル冒頭のとおり。
function estimateSeconds(
  q: MasterQuestion,
  review: Review | undefined,
  stats: TimeStats,
): number {
  const own = stats.measured[q.id]
  if (own !== undefined) return own
  const byKind = stats.byKind[timeKindOf(q.id)]
  if (byKind != null) return byKind
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

// 所要時間の表示。1分未満は「1分未満」に丸める（0分と出さない）。
// 60分以上は「3時間41分」の形にする。「221分」のままでは体感の長さに変換する手間が
// 読み手に残り、今日どれだけ要るのかが一目で入ってこないため。
// 端数のない時間は「3時間」と出す（「3時間0分」とは書かない）。
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0分'
  if (minutes < 1) return '1分未満'
  // 先に丸めてから時間・分へ分解する（59.7分を「0時間60分」と出さないため）。
  const total = Math.round(minutes)
  if (total < 60) return `${total}分`
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return mins === 0 ? `${hours}時間` : `${hours}時間${mins}分`
}
