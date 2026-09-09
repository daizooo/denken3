// 切り上げ時間（答えを見る目安）と、手動一時停止の回帰テスト。
//
// 固定するのは倍率そのものではなく、切り上げの設計が壊れていないこと:
//
//   ① 問題に応じて変わる（難易度・studyMode・A/B問題）。一律の定数ではない
//   ② 本番の持ち時間を超えて鳴らさない（そこまで粘っても本番の得点にはならない）
//   ③ **理解度では変わらない** ―― 初版は STATUS_FACTOR 込みの推定を基準にしたため、
//      理解度A の難易度1計算が 1.5分（下限）まで潰れていた。復習は忘れているかも
//      しれないから解くのであって、分かっている「はず」の問題ほど急かすのは逆向き
//   ④ **その問題自身の直近の実測では変わらない** ―― 1サンプルに引きずられると、
//      切り上げ→記録時間の短縮→さらに短い切り上げ、というラチェットになる
//   ⑤ 実測中央値は「伸ばす方向」にだけ効く（短すぎる切り上げは有害・長すぎるのは無害）
//   ⑥ 手動停止は、タブ復帰の自動再開に上書きされない
//   ⑦ 手動停止は経過を捨てない（中断＝onAbort とは別物）

import { describe, it, expect } from 'vitest'
import { cutoffSeconds, typicalSeconds, formatClock } from './solveTimer'
import type { TimeStats } from './estimateMinutes'
import { A_LIMIT_SECONDS, B_LIMIT_SECONDS } from './examTime'
import { elapsedMs, pauseTimer, resumeTimer, setManualPause, startTimer } from './timer'
import type { MasterQuestion, StudyMode } from '../domain/types'

function q(
  difficulty: 1 | 2 | 3,
  studyMode: StudyMode | undefined,
  title = '合成抵抗（H16-A4）',
): MasterQuestion {
  return { id: 'q1', number: 1, title, difficulty, studyMode }
}

// 実測がまだ1件も無い状態（既定表だけで決まる）。
function emptyStats(): TimeStats {
  const row = { calc: null, memory: null, unset: null }
  return {
    byModeBand: { 1: { ...row }, 2: { ...row }, 3: { ...row } },
    byBand: { 1: null, 2: null, 3: null },
    measured: {},
    measuredN: 0,
  }
}

const B_TITLE = 'RLC直列回路（H17-B15）'

const examLimitOf = (title: string) => (title === B_TITLE ? B_LIMIT_SECONDS : A_LIMIT_SECONDS)

describe('cutoffSeconds', () => {
  it('① 難易度・studyMode で変わる', () => {
    const s = emptyStats()
    // 既定表: 難易度1 calc 120秒 / memory 90秒、難易度2 calc 330秒。
    expect(cutoffSeconds(q(1, 'memory'), s)).toBe(135) // 2分15秒
    expect(cutoffSeconds(q(1, 'calc'), s)).toBe(180)   // 3分
    expect(cutoffSeconds(q(2, 'memory'), s)).toBe(225) // 3分45秒
  })

  it('③ 理解度では変わらない（難易度1の計算は常に3分）', () => {
    // 理解度は引数に無い＝型で排除されている。初版はここが 90秒（1.5分）に潰れていた。
    expect(cutoffSeconds(q(1, 'calc'), emptyStats())).toBe(180)
  })

  it('④ その問題自身の直近の実測では変わらない', () => {
    const s = emptyStats()
    s.measured['q1'] = 20 // 前回20秒で解けた
    s.measuredN = 1
    expect(cutoffSeconds(q(1, 'calc'), s)).toBe(180)
  })

  it('⑤ 実測中央値は伸ばす方向にだけ効く', () => {
    const slow = emptyStats()
    slow.byModeBand[1].calc = 200 // 既定120秒より遅い → 200×1.5
    expect(cutoffSeconds(q(1, 'calc'), slow)).toBe(300)

    const fast = emptyStats()
    fast.byModeBand[1].calc = 40 // 既定より速くても既定を下回らない
    expect(cutoffSeconds(q(1, 'calc'), fast)).toBe(180)
  })

  it('studyMode 未設定は calc と memory の平均を使う', () => {
    // 難易度1: (120 + 90) / 2 = 105 → ×1.5
    expect(cutoffSeconds(q(1, undefined), emptyStats())).toBe(158)
  })

  it('② A問題は本番の持ち時間（5分）を超えない', () => {
    // 難易度3 calc は既定540秒 → ×1.5 = 810秒だが、A問題の持ち時間で頭打ち。
    expect(cutoffSeconds(q(3, 'calc'), emptyStats())).toBe(A_LIMIT_SECONDS)
  })

  it('② B問題は本番の持ち時間（10分）まで伸びる', () => {
    expect(cutoffSeconds(q(3, 'calc', B_TITLE), emptyStats())).toBe(B_LIMIT_SECONDS)
    // 同じ問題でも B問題のほうが長い（小問2つぶんの時間が要る）。
    expect(cutoffSeconds(q(2, 'calc', B_TITLE), emptyStats()))
      .toBeGreaterThan(cutoffSeconds(q(2, 'calc'), emptyStats()))
  })

  it('典型どおりに解けている間は鳴らない（典型所要 < 切り上げ）', () => {
    const s = emptyStats()
    for (const d of [1, 2, 3] as const) {
      for (const m of ['calc', 'memory'] as const) {
        for (const title of ['合成抵抗（H16-A4）', B_TITLE]) {
          const item = q(d, m, title)
          const cut = cutoffSeconds(item, s)
          const typical = typicalSeconds(item, s)
          // 上限で頭打ちになる組み合わせ（難易度3のA問題など）だけは典型所要を下回りうる。
          if (cut < examLimitOf(title)) expect(cut).toBeGreaterThan(typical)
        }
      }
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
  it('⑦ 停止しても、ここまでの経過は残る', () => {
    const t0 = startTimer('2026-09-09', 1000)
    const paused = setManualPause(t0, true, 31000) // 30秒経過して停止
    expect(elapsedMs(paused, 99999)).toBe(30000)   // 以降どれだけ経っても増えない
  })

  it('⑥ 停止中はタブ復帰（resumeTimer）で再開しない', () => {
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
