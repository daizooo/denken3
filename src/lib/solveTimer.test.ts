// 切り上げ時間（答えを見る目安）と、手動一時停止の回帰テスト。
//
// 固定するのは倍率や下限の数値そのものではなく、切り上げの設計が壊れていないこと:
//
//   ① 速い問題ほど早く鳴る（一律ではない ―― でなければアラームは情報を持たない）
//   ② 本番の持ち時間を超えて鳴らさない（そこまで粘っても本番の得点にはならない）
//   ③ 想起の余地を潰さない下限がある（推定が短い問題で即座に鳴らさない）
//   ④ 手動停止は、タブ復帰の自動再開に上書きされない
//   ⑤ 手動停止は経過を捨てない（中断＝onAbort とは別物）

import { describe, it, expect } from 'vitest'
import { cutoffSeconds, formatClock, CUTOFF_MIN_SECONDS } from './solveTimer'
import { A_LIMIT_SECONDS, B_LIMIT_SECONDS } from './examTime'
import { elapsedMs, pauseTimer, resumeTimer, setManualPause, startTimer } from './timer'

const A_TITLE = '合成抵抗（H16-A4）'
const B_TITLE = 'RLC直列回路（H17-B15）'

describe('cutoffSeconds', () => {
  it('① 推定が短い問題ほど早く鳴る', () => {
    // 難易度2の計算問題（推定5.5分）と、難易度1の暗記問題（推定1.5分）。
    expect(cutoffSeconds(A_TITLE, 2)).toBeLessThan(cutoffSeconds(A_TITLE, 5.5))
  })

  it('② A問題は本番の持ち時間（5分）を超えない', () => {
    expect(cutoffSeconds(A_TITLE, 9)).toBe(A_LIMIT_SECONDS)
  })

  it('② B問題は本番の持ち時間（10分）まで伸びる', () => {
    expect(cutoffSeconds(B_TITLE, 30)).toBe(B_LIMIT_SECONDS)
    // 同じ推定でも B問題のほうが長い（小問2つぶんの時間が要る）。
    expect(cutoffSeconds(B_TITLE, 8)).toBeGreaterThan(cutoffSeconds(A_TITLE, 8))
  })

  it('③ 推定が極端に短くても下限を下回らない', () => {
    expect(cutoffSeconds(A_TITLE, 0.2)).toBe(CUTOFF_MIN_SECONDS)
  })

  it('推定どおりに解けている間は鳴らない（推定 < 切り上げ）', () => {
    for (const minutes of [1.5, 2, 2.5, 3]) {
      expect(cutoffSeconds(A_TITLE, minutes)).toBeGreaterThan(minutes * 60)
    }
  })
})

describe('formatClock', () => {
  it('分:秒で表示する', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(7)).toBe('0:07')
    expect(formatClock(187)).toBe('3:07')
    expect(formatClock(300)).toBe('5:00')
  })

  it('60分以上は時:分:秒にする', () => {
    expect(formatClock(3723)).toBe('1:02:03')
  })
})

describe('手動一時停止', () => {
  it('⑤ 停止しても、ここまでの経過は残る', () => {
    const t0 = startTimer('2026-09-09', 1000)
    const paused = setManualPause(t0, true, 31000) // 30秒経過して停止
    expect(elapsedMs(paused, 99999)).toBe(30000)   // 以降どれだけ経っても増えない
  })

  it('④ 停止中はタブ復帰（resumeTimer）で再開しない', () => {
    const t0 = startTimer('2026-09-09', 1000)
    const paused = setManualPause(t0, true, 31000)
    // 別アプリへ移って戻る（非表示→表示）。
    const back = resumeTimer(pauseTimer(paused, 40000), 50000)
    expect(back.startedAt).toBeNull()
    expect(elapsedMs(back, 99999)).toBe(30000)
  })

  it('再開すると、その時点から加算が続く', () => {
    const t0 = startTimer('2026-09-09', 1000)
    const paused = setManualPause(t0, true, 31000)
    const resumed = setManualPause(paused, false, 100000)
    expect(elapsedMs(resumed, 110000)).toBe(40000) // 30秒 + 10秒
    // 再開後はタブ復帰の自動再開も従来どおり効く。
    expect(resumeTimer(pauseTimer(resumed, 110000), 200000).startedAt).toBe(200000)
  })
})
