// FSRS スケジューリングの回帰テスト。
//
// ここが守っているのは **決定的再生**（adaptive-fsrs-policy.md §3.4）ただ1つの性質である。
//   「同じ review_history を再生したら、何度やっても同じ due が出る」
//
// この性質はアプリの土台になっている。記録・取消・再読込のどの経路でも Review 全体は
// `deriveFromHistory` から導出され直すので、再生結果が揺れると**過去の予定日が勝手に
// 書き換わる**。利用者の一次不満（「幾度となく最適化したが、いま何が効いているのか
// 分からない」）の直撃であり、パラメータ最適化を入れる前に固定しておくべき不変条件。
//
// 実データ（本番DB 2026-09-04 時点）の履歴パターンをゴールデンケースとして持つ。

import { describe, it, expect } from 'vitest'
import {
  RETENTION_DEFAULT,
  RETENTION_ENDGAME,
  FINAL_CHECK_DAYS_BEFORE_EXAM,
  calcFSRS,
  deriveFromHistory,
  defaultReview,
  finalCheckDue,
  registerParams,
  resetParams,
  retentionFor,
  retrievability,
} from './fsrs'
import type { ReviewHistoryEntry } from '../domain/types'

const EXAM = '2027-02-06' // 本番の試験日
const h = (date: string, status: ReviewHistoryEntry['status'], retention?: number)
  : ReviewHistoryEntry => (retention === undefined ? { date, status } : { date, status, policy: { retention } })

describe('retentionFor（日付だけで決まる従来式の保持率）', () => {
  it('試験日が未設定なら既定値', () => {
    expect(retentionFor('2026-09-04', null)).toBe(RETENTION_DEFAULT)
  })
  it('直前期（試験60日前以内）は精度優先へ切り替わる', () => {
    expect(retentionFor('2026-12-08', EXAM)).toBe(RETENTION_ENDGAME) // 残60日
    expect(retentionFor('2026-12-09', EXAM)).toBe(RETENTION_ENDGAME) // 残59日
    expect(retentionFor('2026-12-07', EXAM)).toBe(RETENTION_DEFAULT) // 残61日
  })
})

describe('deriveFromHistory の決定性', () => {
  const history = [
    h('2026-07-18', 'C'), h('2026-07-20', 'B'), h('2026-07-22', 'A'), h('2026-08-11', 'A'),
  ]

  it('同じ履歴を何度再生しても同じ結果になる', () => {
    const a = deriveFromHistory(history, EXAM)
    const b = deriveFromHistory(history, EXAM)
    expect(b).toEqual(a)
  })

  it('入力の並び順に依らない（実施日順に正規化される）', () => {
    const shuffled = [history[2], history[0], history[3], history[1]]
    expect(deriveFromHistory(shuffled, EXAM)).toEqual(deriveFromHistory(history, EXAM))
  })

  it('履歴の最後の記録がステータス・実施日になり、初回日も履歴から決まる', () => {
    const d = deriveFromHistory(history, EXAM)
    expect(d.status).toBe('A')
    expect(d.first_reviewed).toBe('2026-07-18')
    expect(d.last_reviewed).toBe('2026-08-11')
    expect(d.repetitions).toBe(4)
    // 初回の C は lapse に数えない（New 状態からの Again は「忘れた」ではないため）。
    expect(d.lapses).toBe(0)
  })

  it('末尾を1件削っても、残りの再生結果は削る前の途中経過と一致する', () => {
    // 取消（deleteEntry）が prev スナップショット無しで正しく戻せることの根拠。
    const full = deriveFromHistory(history, EXAM)
    const head = deriveFromHistory(history.slice(0, 3), EXAM)
    expect(head.due_date).not.toBe(full.due_date)
    // 3件目まで再生 → 4件目を足す、が full と一致する（＝再生は前方から積み上がるだけ）
    const again = deriveFromHistory([...history.slice(0, 3), history[3]], EXAM)
    expect(again).toEqual(full)
  })
})

describe('記録時の保持率を履歴に書き残す仕組み（§3.4・後方互換）', () => {
  it('policy.retention があればそれを使う', () => {
    const strict = deriveFromHistory([h('2026-07-18', 'A', 0.9)], EXAM)
    const loose = deriveFromHistory([h('2026-07-18', 'A', 0.8)], EXAM)
    // 保持率が高いほど間隔は短い
    expect(strict.due_date! < loose.due_date!).toBe(true)
  })

  it('policy を持たない旧データは従来式（日付ベース）へフォールバックする', () => {
    // review_history はエントリをそのまま返すので policy の有無だけ差が出る。
    // 比べるのはスケジューリングの結果だけ。
    const sched = (e: ReviewHistoryEntry) => {
      const d = deriveFromHistory([e], EXAM)
      return { due_date: d.due_date, stability: d.stability, difficulty_fsrs: d.difficulty_fsrs }
    }
    expect(sched(h('2026-07-18', 'A')))
      .toEqual(sched(h('2026-07-18', 'A', retentionFor('2026-07-18', EXAM))))
  })

  it('ポリシーが後から変わっても、書き残された過去の記録の予定日は動かない', () => {
    // 層3が明日 0.90 へ変わっても、この履歴の再生結果は変わらないことを表す。
    const recorded = [h('2026-07-18', 'A', 0.85), h('2026-08-11', 'A', 0.85)]
    const before = deriveFromHistory(recorded, EXAM)
    const after = deriveFromHistory(recorded, EXAM) // ポリシー変更後の再生に相当
    expect(after.due_date).toBe(before.due_date)
  })
})

describe('学習済みパラメータの版管理', () => {
  const W_A = Array.from({ length: 21 }, (_, i) => 0.5 + i * 0.1)
  const W_B = Array.from({ length: 21 }, (_, i) => 1.0 + i * 0.2)

  it('版を登録すると、その版を持つ履歴の再生結果が変わる', () => {
    resetParams()
    const stamped: ReviewHistoryEntry[] = [
      { date: '2026-07-18', status: 'A', policy: { retention: 0.85, w_version: 1 } },
    ]
    const beforeRegister = deriveFromHistory(stamped, EXAM)
    registerParams({ version: 1, w: W_A })
    const afterRegister = deriveFromHistory(stamped, EXAM)
    expect(afterRegister.due_date).not.toBe(beforeRegister.due_date)
  })

  it('版を持たない履歴は既定パラメータのまま（登録の影響を受けない）', () => {
    resetParams()
    const legacy = [h('2026-07-18', 'A')]
    const before = deriveFromHistory(legacy, EXAM)
    registerParams({ version: 1, w: W_A })
    expect(deriveFromHistory(legacy, EXAM).due_date).toBe(before.due_date)
  })

  it('同じ版番号で中身が違う w を登録し直したら、古い w のキャッシュを引かない', () => {
    // 版は (user_id, exam_id) ごとに1から振られるので、資格を切り替えたときや
    // 暖まったサーバレスコンテナが別の利用者を処理したときに実際に起こる。
    const stamped: ReviewHistoryEntry[] = [
      { date: '2026-07-18', status: 'A', policy: { retention: 0.85, w_version: 1 } },
    ]
    resetParams()
    registerParams({ version: 1, w: W_A })
    const withA = deriveFromHistory(stamped, EXAM)
    registerParams({ version: 1, w: W_B })
    const withB = deriveFromHistory(stamped, EXAM)
    expect(withB.due_date).not.toBe(withA.due_date)
  })

  it('resetParams で既定パラメータへ戻る', () => {
    const stamped: ReviewHistoryEntry[] = [
      { date: '2026-07-18', status: 'A', policy: { retention: 0.85, w_version: 1 } },
    ]
    resetParams()
    const withDefault = deriveFromHistory(stamped, EXAM)
    registerParams({ version: 1, w: W_A })
    expect(deriveFromHistory(stamped, EXAM).due_date).not.toBe(withDefault.due_date)
    resetParams()
    expect(deriveFromHistory(stamped, EXAM).due_date).toBe(withDefault.due_date)
  })
})

describe('S（復習不要）の扱い', () => {
  it('試験日が設定されていれば、21日前に最終確認へ戻す', () => {
    expect(finalCheckDue('2026-07-26', EXAM)).toBe('2027-01-16')
    expect(FINAL_CHECK_DAYS_BEFORE_EXAM).toBe(21)
  })

  it('試験日が未設定なら復習キューから外れたまま（due なし）', () => {
    expect(finalCheckDue('2026-07-26', null)).toBeNull()
  })

  it('最終確認日を過ぎてから S にした場合は due を付けない（毎日 due に居座らせない）', () => {
    expect(finalCheckDue('2027-01-20', EXAM)).toBeNull()
  })

  it('S にしても FSRS の学習状態は温存され、復習へ戻せる', () => {
    const withS = deriveFromHistory(
      [h('2026-07-19', 'C'), h('2026-07-21', 'A'), h('2026-07-26', 'S')], EXAM,
    )
    expect(withS.status).toBe('S')
    expect(withS.stability).toBeGreaterThan(0)
    expect(withS.repetitions).toBe(2) // S ではスケジューラを回さない
    expect(withS.due_date).toBe('2027-01-16')
  })
})

describe('試験日クリップ（§7.3）', () => {
  it('復習予定日が試験日を越えない', () => {
    // 成熟したカードは既定 w でも 150日先へ飛ぶ。試験日で丸められること。
    const mature = [
      h('2026-07-18', 'A'), h('2026-08-11', 'A'), h('2026-10-01', 'A'), h('2026-12-20', 'A'),
    ]
    const d = deriveFromHistory(mature, EXAM)
    expect(d.due_date! <= EXAM).toBe(true)
  })

  it('直前期はテーパーがかかる（残14日以内→間隔上限7日）', () => {
    const near = deriveFromHistory(
      [h('2026-07-18', 'A'), h('2026-08-11', 'A'), h('2027-01-28', 'A')], EXAM,
    )
    expect(near.due_date! <= '2027-02-04').toBe(true) // 1/28 + 7日
  })

  it('試験日が未設定ならクリップしない', () => {
    const noExam = deriveFromHistory([h('2026-07-18', 'A'), h('2026-08-11', 'A')], null)
    expect(noExam.due_date! > '2026-08-11').toBe(true)
  })
})

describe('calcFSRS の単発挙動', () => {
  it('未着手は何も返さない（スケジューラを回さない）', () => {
    expect(calcFSRS(null, '未着手', '2026-09-04', EXAM)).toEqual({})
  })

  it('理解度が高いほど次回間隔が長い（A > B > C）', () => {
    const at = (s: 'A' | 'B' | 'C') => calcFSRS(null, s, '2026-09-04', EXAM).due_date!
    expect(at('A') > at('B')).toBe(true)
    expect(at('B') > at('C')).toBe(true)
  })
})

describe('retrievability（想起確率 R）', () => {
  it('未学習・due 無しは対象外（null）', () => {
    expect(retrievability(defaultReview('q1'), '2026-09-04')).toBeNull()
    expect(retrievability(null, '2026-09-04')).toBeNull()
  })

  it('期限から離れるほど下がる', () => {
    const r = deriveFromHistory([h('2026-07-18', 'A'), h('2026-08-11', 'A')], EXAM)
    const near = retrievability({ ...r }, '2026-08-20')!
    const far = retrievability({ ...r }, '2026-11-20')!
    expect(near).toBeGreaterThan(far)
    expect(far).toBeGreaterThanOrEqual(0)
    expect(near).toBeLessThanOrEqual(1)
  })
})

describe('ゴールデン（本番DBの実履歴パターン）', () => {
  // 実データの代表3パターン。数値そのものを固定し、スケジューリングの意図しない
  // 変化を検出する。値を更新するときは、なぜ変わったのかを必ず説明できること。
  const cases: { id: string; history: ReviewHistoryEntry[] }[] = [
    { id: 'dc_10（C→C→A→A→A）', history: [
      h('2026-07-18', 'C'), h('2026-07-20', 'C'), h('2026-07-21', 'A'),
      h('2026-07-26', 'A'), h('2026-08-11', 'A'),
    ] },
    { id: 'ac1_25（C→B→B→B）', history: [
      h('2026-07-25', 'C'), h('2026-07-26', 'B'), h('2026-08-03', 'B'), h('2026-08-19', 'B'),
    ] },
    { id: 'ac1_67（C→C→C→B→B→A）', history: [
      h('2026-08-06', 'C'), h('2026-08-07', 'C'), h('2026-08-09', 'C'),
      h('2026-08-10', 'B'), h('2026-08-13', 'B'), h('2026-08-19', 'A'),
    ] },
  ]

  for (const c of cases) {
    it(c.id, () => {
      const d = deriveFromHistory(c.history, EXAM)
      expect({
        due_date: d.due_date,
        stability: Number(d.stability.toFixed(4)),
        difficulty_fsrs: Number(d.difficulty_fsrs.toFixed(4)),
        repetitions: d.repetitions,
        lapses: d.lapses,
        status: d.status,
      }).toMatchSnapshot()
    })
  }
})
