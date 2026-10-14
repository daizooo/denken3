// 足切りダッシュボード・5月末ゲート（licensehub-expansion.md §10.2・PR-I）。架空の肢ID（フィクスチャの年度 R98）で組み立てる（本文は使わない）。
import { describe, expect, it } from 'vitest'
import type { Status } from '../../domain/types'
import { SHAROUSHI_GATE_THRESHOLDS, SHAROUSHI_SCORING } from '../../data/sharoushi/index.ts'
import {
  countableItems, estimateScore, gateSource, judgeGate, parseSectionScores, subjectRows,
  type CutoffInput, type CutoffItem, type ExternalScore, type FinishedMock,
} from './cutoff'

const T = SHAROUSHI_GATE_THRESHOLDS
const STUDY: Record<string, string> = { RK: 'rouki', RS: 'rousai', KY: 'koyou', RI: 'rouippan', SI: 'shaippan', IP: 'rouippan', KH: 'kenpo', KO: 'kounen', KN: 'kokunen' }
const LABELS = ['A', 'B', 'C', 'D', 'E']

// 択一: 科目ごとに n 問×5肢、選択式: 科目ごとに5空欄
function makeItems(n = 5, year = 'R98'): CutoffItem[] {
  const out: CutoffItem[] = []
  for (const sec of SHAROUSHI_SCORING.sections) {
    for (const s of sec.subjects) {
      if (sec.id === 'taku') {
        for (let q = 1; q <= n; q++) for (const l of LABELS) out.push({ id: `${year}_T_${s.code}_${String(q).padStart(2, '0')}_${l}`, scored_subject: s.code, study_subject: STUDY[s.code], law_status: 'ok' })
      } else {
        for (const l of LABELS) out.push({ id: `${year}_S_${s.code}_${l}`, scored_subject: s.code, study_subject: STUDY[s.code], law_status: 'ok' })
      }
    }
  }
  return out
}

const full = (sec: 'taku' | 'sentaku', pts: number, over: Record<string, number> = {}) =>
  Object.fromEntries(SHAROUSHI_SCORING.sections.find(s => s.id === sec)!.subjects.map(s => [s.code, over[s.code] ?? pts]))

function input(over: Partial<CutoffInput> = {}): CutoffInput {
  return {
    model: SHAROUSHI_SCORING, items: makeItems(), statusOf: () => 'A', recallOf: () => 0.9,
    externals: [], mocks: [], thresholds: T, excludeYears: [], ...over,
  }
}

const ext = (taken_on: string, taku: Record<string, number> | null, sentaku: Record<string, number> | null): ExternalScore =>
  ({ id: taken_on, label: `架空模試 ${taken_on}`, taken_on, taku_scores: taku, sentaku_scores: sentaku })
const mock = (subject_id: 'taku' | 'sentaku', scores: Record<string, number>, paper_id = 'R07'): FinishedMock =>
  ({ subject_id, paper_id, finished_at: '2027-03-10T10:00:00Z', section_scores: scores })

describe('閾値（推定値）は SHAROUSHI_GATE_THRESHOLDS の1か所', () => {
  it('§10.2 の値', () => {
    expect(T.blue).toEqual({ taku: 42, sentaku: 23, maxFloorFailures: 1 })
    expect(T.redTakuBelow).toBe(35)
    expect(T.yellowFloorFailures).toBe(2)
  })
})

describe('subjectRows（採点科目別）', () => {
  it('選択式8・択一7 の科目が並ぶ', () => {
    const rows = subjectRows(input())
    expect(rows.filter(r => r.section === 'sentaku')).toHaveLength(8)
    expect(rows.filter(r => r.section === 'taku')).toHaveLength(7)
  })

  it('正答率は直近 S・A・B を正解、C を誤答、未着手は数えない。想起確率は平均', () => {
    const statuses: Record<string, Status> = {}
    const items = makeItems()
    const rk = items.filter(i => i.id.includes('_T_RK_'))
    rk.forEach((it, k) => { statuses[it.id] = k < 15 ? 'A' : k < 20 ? 'C' : '未着手' })   // 25肢: 正解15・誤答5・未着手5
    const recall: Record<string, number> = { [rk[0].id]: 0.6, [rk[1].id]: 0.8 }
    const rows = subjectRows(input({ items, statusOf: id => statuses[id], recallOf: id => recall[id] ?? null }))
    const r = rows.find(x => x.section === 'taku' && x.code === 'RK')!
    expect(r.items).toBe(25)
    expect(r.attempted).toBe(20)
    expect(r.accuracy).toBeCloseTo(0.75)
    expect(r.recallAvg).toBeCloseTo(0.7)
    expect(r.insufficient).toBe(false)
    expect(r.estimated).toBe(estimateScore('taku', 10, 0.75, T.estimateExponent))
    expect(r.basis).toBe('estimate')
  })

  it('データが無い・少ない科目は「データ不足」で、推定値を出さない', () => {
    const rows = subjectRows(input({ statusOf: () => undefined, recallOf: () => null }))
    for (const r of rows) {
      expect(r.insufficient).toBe(true)
      expect(r.accuracy).toBeNull()
      expect(r.estimated).toBeNull()
      expect(r.floorGap).toBeNull()
    }
    // 選択式は1科目5空欄 < minAttempted（20）なので、全部解いてもデータ不足
    const solved = subjectRows(input())
    expect(solved.find(r => r.section === 'sentaku')!.insufficient).toBe(true)
    expect(solved.find(r => r.section === 'taku')!.insufficient).toBe(false)
  })

  it('法改正の確認待ち（unchecked・review）と excluded の肢は集計に入らない', () => {
    const items = makeItems().map(it => it.id.includes('_T_RK_01_') ? { ...it, law_status: 'unchecked' }
      : it.id.includes('_T_RK_02_') ? { ...it, law_status: 'review' }
        : it.id.includes('_T_RK_03_') ? { ...it, law_status: 'excluded' } : it)
    const wrong = new Set(items.filter(i => /_T_RK_0[123]_/.test(i.id)).map(i => i.id))
    const rows = subjectRows(input({ items, statusOf: id => (wrong.has(id) ? 'C' : 'A') }))
    const r = rows.find(x => x.section === 'taku' && x.code === 'RK')!
    expect(r.items).toBe(10)
    expect(r.accuracy).toBe(1)
    expect(countableItems(items, [])).toHaveLength(makeItems().length - 15)
  })

  it('フィクスチャの年度は既定で除く', () => {
    expect(countableItems(makeItems(5, 'R98'))).toHaveLength(0)
    expect(countableItems(makeItems(5, 'R05'))).toHaveLength(makeItems().length)
  })

  it('足切りラインとの差は 公開模試 → 本番形式模試 → 推定 の順', () => {
    const base = subjectRows(input({ mocks: [mock('taku', full('taku', 6))] })).find(r => r.section === 'taku' && r.code === 'RK')!
    expect(base.mockScore).toBe(6)
    expect(base.basis).toBe('mock')
    expect(base.floorGap).toBe(2)
    const withExt = subjectRows(input({ mocks: [mock('taku', full('taku', 6))], externals: [ext('2027-05-10', full('taku', 3), null)] }))
      .find(r => r.section === 'taku' && r.code === 'RK')!
    expect(withExt.externalScore).toBe(3)
    expect(withExt.mockScore).toBe(6)
    expect(withExt.basis).toBe('external')
    expect(withExt.floorGap).toBe(-1)
  })
})

describe('judgeGate（5月末ゲート）', () => {
  const ok = { taku: full('taku', 6), sentaku: full('sentaku', 3) }   // 択一42・選択式24・足切りなし

  it('得点が無ければデータ不足', () => {
    const g = judgeGate(input())
    expect(g.verdict).toBe('insufficient')
  })

  it('公開模試の得点を入力すると判定に反映される（青）', () => {
    expect(judgeGate(input()).verdict).toBe('insufficient')
    const g = judgeGate(input({ externals: [ext('2027-05-20', ok.taku, ok.sentaku)] }))
    expect(g.verdict).toBe('blue')
    expect(g.takuTotal).toBe(42)
    expect(g.sentakuTotal).toBe(24)
    expect(g.taku?.kind).toBe('external')
    expect(g.includesStudied).toBe(false)
  })

  it('公開模試を優先し、無ければ本番形式模試（既習を含む）', () => {
    const mocks = [mock('taku', full('taku', 5)), mock('sentaku', full('sentaku', 3))]
    const fromMock = judgeGate(input({ mocks }))
    expect(fromMock.taku?.kind).toBe('mock')
    expect(fromMock.includesStudied).toBe(true)
    expect(fromMock.verdict).toBe('yellow')   // 択一35
    const fromExt = judgeGate(input({ mocks, externals: [ext('2027-05-20', ok.taku, null)] }))
    expect(fromExt.taku?.kind).toBe('external')
    expect(fromExt.sentaku?.kind).toBe('mock')
    expect(fromExt.verdict).toBe('blue')
  })

  it('最新の公開模試を使う', () => {
    const g = judgeGate(input({ externals: [ext('2027-05-20', ok.taku, ok.sentaku), ext('2027-04-01', full('taku', 2), ok.sentaku)] }))
    expect(g.takuTotal).toBe(42)
    expect(gateSource([ext('2027-04-01', full('taku', 2), null)], [], 'taku', [])?.label).toContain('2027-04-01')
  })

  it('黄: 択一35〜41、または足切り科目が2', () => {
    expect(judgeGate(input({ externals: [ext('2027-05-20', full('taku', 5), ok.sentaku)] })).verdict).toBe('yellow')   // 35
    const two = judgeGate(input({ externals: [ext('2027-05-20', full('taku', 8, { RK: 3, KH: 3 }), ok.sentaku)] }))
    expect(two.floorFailures).toHaveLength(2)
    expect(two.verdict).toBe('yellow')
    const one = judgeGate(input({ externals: [ext('2027-05-20', full('taku', 7, { RK: 3 }), ok.sentaku)] }))
    expect(one.verdict).toBe('blue')
  })

  it('選択式23未満は青にしない（黄）。23ちょうどは青', () => {
    const g22 = judgeGate(input({ externals: [ext('2027-05-20', ok.taku, full('sentaku', 3, { KN: 1 }))] }))
    expect(g22.sentakuTotal).toBe(22)
    expect(g22.verdict).toBe('yellow')
    const g23 = judgeGate(input({ externals: [ext('2027-05-20', ok.taku, full('sentaku', 3, { KN: 2 }))] }))
    expect(g23.sentakuTotal).toBe(23)
    expect(g23.floorFailures).toEqual([{ section: 'sentaku', code: 'KN' }])
    expect(g23.verdict).toBe('blue')
  })

  it('赤: 択一35未満、1周目未完了、一般常識が未着手、足切り科目が3以上', () => {
    expect(judgeGate(input({ externals: [ext('2027-05-20', full('taku', 4, { RK: 6 }), ok.sentaku)] })).verdict).toBe('red')   // 34
    const lap = judgeGate(input({ statusOf: id => (id.endsWith('_E') ? undefined : 'A'), externals: [ext('2027-05-20', ok.taku, ok.sentaku)] }))
    expect(lap.verdict).toBe('red')
    expect(lap.reasons).toContain('1周目未完了')
    const gen = judgeGate(input({
      items: makeItems().filter(i => i.study_subject !== 'shaippan'),
      externals: [ext('2027-05-20', ok.taku, ok.sentaku)],
      studyNames: { shaippan: '社一' },
    }))
    expect(gen.verdict).toBe('red')
    expect(gen.untouchedGeneral).toEqual(['shaippan'])
    expect(gen.reasons).toContain('社一が未着手')
    const three = judgeGate(input({ externals: [ext('2027-05-20', full('taku', 8, { RK: 3, KH: 3, KO: 3 }), ok.sentaku)] }))
    expect(three.verdict).toBe('red')
  })

  it('法改正の確認待ちの肢は、1周目の判定にも入らない', () => {
    const items = makeItems().map(it => (it.id.includes('_T_RK_01_') ? { ...it, law_status: 'review' } : it))
    const g = judgeGate(input({ items, statusOf: id => (id.includes('_T_RK_01_') ? undefined : 'A'), externals: [ext('2027-05-20', ok.taku, ok.sentaku)] }))
    expect(g.firstLapDone).toBe(true)
    expect(g.verdict).toBe('blue')
  })
})

describe('parseSectionScores（公開模試の得点入力）', () => {
  const taku = SHAROUSHI_SCORING.sections.find(s => s.id === 'taku')!
  it('全科目が空欄なら未入力（null）', () => {
    expect(parseSectionScores(taku, {})).toEqual({ scores: null, errors: [] })
  })
  it('全科目を入れれば得点になる', () => {
    const raw = Object.fromEntries(taku.subjects.map(s => [s.code, '6']))
    expect(parseSectionScores(taku, raw).scores).toEqual(full('taku', 6))
  })
  it('一部だけ・範囲外・小数はエラー', () => {
    expect(parseSectionScores(taku, { RK: '6' }).errors.length).toBe(6)
    const raw = Object.fromEntries(taku.subjects.map(s => [s.code, '6']))
    expect(parseSectionScores(taku, { ...raw, RK: '11' }).errors).toHaveLength(1)
    expect(parseSectionScores(taku, { ...raw, RK: '2.5' }).errors).toHaveLength(1)
  })
})
