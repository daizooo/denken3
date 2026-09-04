// 再計算の回帰テスト。守るのは1点だけ ――
// **再計算した結果は、そのあと履歴を再生しても同じものが出る。**
//
// これが崩れると、DBに書いた予定日と、記録・取消・再読込のたびに走る
// deriveFromHistory の結果が食い違う。prev スナップショットで実際に起きていた不整合
// （migration 017）と同じ形であり、パラメータ最適化を入れる意味そのものが失われる。

import { describe, it, expect, beforeEach } from 'vitest'
import { reschedule } from './reschedule'
import { deriveFromHistory, registerParams, resetParams, retentionFor } from '../../src/lib/fsrs'
import type { ReviewHistoryEntry, Status } from '../../src/domain/types'

const EXAM = '2027-02-06'
const VERSION = 1

// 本番履歴で実際に学習された w（FSRS-6・21個）。既定より初期安定度が大きい。
const TRAINED_W = [
  0.693, 2.570, 6.394, 14.039, 6.376, 0.839, 3.005, 0.044, 1.963, 0.173, 0.881,
  1.496, 0.071, 0.300, 1.659, 0.601, 1.976, 0.000, 0.000, 0.000, 0.100,
]

const h = (date: string, status: Status): ReviewHistoryEntry => ({ date, status })

const ROWS = [
  { question_id: 'dc_10', review_history: [
    h('2026-07-18', 'C'), h('2026-07-20', 'C'), h('2026-07-21', 'A'),
    h('2026-07-26', 'A'), h('2026-08-11', 'A'),
  ] },
  { question_id: 'ac1_25', review_history: [
    h('2026-07-25', 'C'), h('2026-07-26', 'B'), h('2026-08-03', 'B'), h('2026-08-19', 'B'),
  ] },
  { question_id: 'elec_11', review_history: [h('2026-08-15', 'A')] },
]

function run() {
  return reschedule({
    rows: ROWS, userId: 'u1', examId: 'denken3', examDate: EXAM, version: VERSION, w: TRAINED_W,
  })
}

beforeEach(() => resetParams())

describe('reschedule', () => {
  it('履歴を持つカードだけを返す', () => {
    const out = run()
    expect(out.map(r => r.question_id)).toEqual(['dc_10', 'ac1_25', 'elec_11'])
    const empty = reschedule({
      rows: [{ question_id: 'x', review_history: [] }],
      userId: 'u1', examId: 'denken3', examDate: EXAM, version: VERSION, w: TRAINED_W,
    })
    expect(empty).toHaveLength(0)
  })

  it('全エントリに採用版を刻む', () => {
    for (const row of run()) {
      expect(row.review_history.every(e => e.policy?.w_version === VERSION)).toBe(true)
    }
  })

  it('保持率は記録時の値を保ち、無い場合は再生が使っていた従来式の値を明示する', () => {
    // 旧データ（policy 無し）→ retentionFor(実施日, 試験日) が書き込まれる
    const [row] = run()
    expect(row.review_history[0].policy?.retention).toBe(retentionFor('2026-07-18', EXAM))

    // 記録時の値がある場合はそれを保つ
    const withPolicy = reschedule({
      rows: [{ question_id: 'q', review_history: [
        { date: '2026-07-18', status: 'A', policy: { retention: 0.9 } },
      ] }],
      userId: 'u1', examId: 'denken3', examDate: EXAM, version: VERSION, w: TRAINED_W,
    })
    expect(withPolicy[0].review_history[0].policy?.retention).toBe(0.9)
  })

  it('duration_seconds など他のフィールドは失われない', () => {
    const out = reschedule({
      rows: [{ question_id: 'q', review_history: [
        { date: '2026-07-18', status: 'A', duration_seconds: 245 },
        { date: '2026-08-01', status: 'B', duration_seconds: 90 },
      ] }],
      userId: 'u1', examId: 'denken3', examDate: EXAM, version: VERSION, w: TRAINED_W,
    })
    expect(out[0].review_history.map(e => e.duration_seconds)).toEqual([245, 90])
  })

  it('【最重要】書き込んだ結果は、そのまま再生しても一致する', () => {
    for (const row of run()) {
      // API が書いた行を、アプリ側の経路（deriveFromHistory）で再生する
      const replayed = deriveFromHistory(row.review_history, EXAM)
      expect(replayed.due_date).toBe(row.due_date)
      expect(replayed.stability).toBe(row.stability)
      expect(replayed.difficulty_fsrs).toBe(row.difficulty_fsrs)
      expect(replayed.status).toBe(row.status)
      expect(replayed.repetitions).toBe(row.repetitions)
    }
  })

  it('学習済みパラメータは既定パラメータと違う予定日を出す（＝実際に効いている）', () => {
    const trained = run()
    resetParams()
    // 版を登録しないまま同じ履歴を再生すると、既定パラメータへフォールバックする
    const fallback = ROWS.map(r => deriveFromHistory(r.review_history, EXAM))
    expect(trained[0].due_date).not.toBe(fallback[0].due_date)
    // 学習後は初期安定度が大きく、間隔は伸びる方向
    expect(trained[2].due_date! > fallback[2].due_date!).toBe(true)
  })

  it('版を登録すれば、別プロセスで再生しても同じ結果になる', () => {
    const trained = run()
    resetParams()
    registerParams({ version: VERSION, w: TRAINED_W })
    for (const row of trained) {
      expect(deriveFromHistory(row.review_history, EXAM).due_date).toBe(row.due_date)
    }
  })

  it('試験日クリップは再計算後も効いている', () => {
    for (const row of run()) expect(row.due_date! <= EXAM).toBe(true)
  })
})
