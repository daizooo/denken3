// 進級判定（licensehub-expansion.md §8.2）。学習科目ごとに「次の科目へ進んでよいか」を厳しめに判定する。純関数。
//
// 条件（すべて満たすと合格）:
//   ① 1周完了       索引にあるその科目の肢を、すべて1回以上解いた
//   ② 確信正答率     直近の結果が A（正解×確信。S を含む）の肢が minSureRate 以上（迷いの正解 B は数えない）
//   ③ 重要度A        重要度A（importance=3）の肢で、直近の結果が C の肢が0件
//   ④ 定着           ①〜③を gapDays 日以上空けた2回（記録日の終わり時点）とも満たし、最新の記録日の時点でも満たす
// 閾値は src/data/sharoushi/index.ts の SHAROUSHI_PROGRESSION から受け取る（固定値を埋め込まない）。
import type { MasterQuestion, ReviewHistoryEntry, Status } from '../../domain/types'
import { addDaysStr, diffDays } from '../date'

export interface ProgressionThresholds { minSureRate: number; gapDays: number }

export interface ProgressionSnapshot {
  total: number
  attempted: number
  sure: number              // 直近が A / S の肢
  sureRate: number          // sure / total（肢が無ければ 0）
  importantMisses: string[] // 重要度Aで直近が C の肢
  passes: boolean           // ①〜③
}

export type ProgressionVerdict = 'pass' | 'waiting' | 'fail' | 'empty'

export interface ProgressionResult {
  verdict: ProgressionVerdict   // pass: 合格 / waiting: 条件は満たしたが2回目待ち / fail: 不合格 / empty: 索引に肢が無い
  current: ProgressionSnapshot  // 最新の記録日の終わり時点
  firstPassDate: string | null  // ①〜③を満たした最も早い記録日（④の起点）
  checkFrom: string | null      // waiting のとき、2回目として数えられる最初の日
  weakIds: string[]             // 直近が C・B の肢（弱点。C を先に）
  reasons: string[]             // 満たしていない条件
}

const SURE: ReadonlySet<Status> = new Set<Status>(['A', 'S'])

function snapshotOf(
  total: number, attempted: number, sure: number, importantMisses: string[], t: ProgressionThresholds,
): ProgressionSnapshot {
  const sureRate = total > 0 ? sure / total : 0
  return {
    total, attempted, sure, sureRate, importantMisses,
    passes: total > 0 && attempted === total && sureRate >= t.minSureRate && importantMisses.length === 0,
  }
}

export function judgeProgression(
  items: readonly MasterQuestion[], historyOf: (id: string) => readonly ReviewHistoryEntry[], t: ProgressionThresholds,
): ProgressionResult {
  // 記録を日付順に並べ、各記録日の終わり時点の状態を差分で更新する（肢数 × 記録数に比例）。
  const important = new Set(items.filter(q => q.importance === 3).map(q => q.id))
  const events = items.flatMap(q => historyOf(q.id).map((e, k) => ({ id: q.id, date: e.date, k, status: e.status })))
    .filter(e => e.status !== '未着手')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.k - b.k))
  const latest = new Map<string, Status>()
  const misses = new Set<string>()
  let sure = 0
  const passDates: string[] = []
  let current = snapshotOf(items.length, 0, 0, [], t)
  let lastDate: string | null = null
  for (let n = 0; n < events.length; n++) {
    const e = events[n]
    const prev = latest.get(e.id)
    if (prev && SURE.has(prev)) sure--
    if (SURE.has(e.status)) sure++
    latest.set(e.id, e.status)
    if (important.has(e.id)) { if (e.status === 'C') misses.add(e.id); else misses.delete(e.id) }
    if (n + 1 === events.length || events[n + 1].date !== e.date) {
      current = snapshotOf(items.length, latest.size, sure, [...misses], t)
      lastDate = e.date
      if (current.passes) passDates.push(e.date)
    }
  }
  const weak = items.map(q => ({ id: q.id, s: latest.get(q.id) })).filter(x => x.s === 'C' || x.s === 'B')
  const weakIds = [...weak.filter(x => x.s === 'C'), ...weak.filter(x => x.s === 'B')].map(x => x.id)
  const firstPassDate = passDates[0] ?? null
  const reasons: string[] = []
  if (current.total === 0) return { verdict: 'empty', current, firstPassDate: null, checkFrom: null, weakIds, reasons: ['索引に肢がありません'] }
  if (current.attempted < current.total) reasons.push(`未着手 ${current.total - current.attempted} 肢（1周未完了）`)
  if (current.sureRate < t.minSureRate) reasons.push(`確信正答率 ${Math.round(current.sureRate * 100)}%（基準 ${Math.round(t.minSureRate * 100)}%）`)
  if (current.importantMisses.length > 0) reasons.push(`重要度Aの誤答 ${current.importantMisses.length} 肢`)

  if (!current.passes || lastDate === null) return { verdict: 'fail', current, firstPassDate, checkFrom: null, weakIds, reasons }
  const earlier = passDates.find(d => diffDays(d, lastDate) >= t.gapDays)
  if (earlier) return { verdict: 'pass', current, firstPassDate: earlier, checkFrom: null, weakIds, reasons }
  // 今回が1回目（または間隔が足りない）: 最も早い合格日から gapDays 後の記録で2回目になる
  const base = firstPassDate ?? lastDate
  const checkFrom = addDaysStr(base, t.gapDays)
  return { verdict: 'waiting', current, firstPassDate: base, checkFrom, weakIds, reasons: [`${checkFrom} 以降の記録で、もう一度条件を満たす（定着の確認）`] }
}
