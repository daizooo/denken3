import { describe, expect, it } from 'vitest'
import { explainProblems, svgDataUrl, svgProblems, type ExplainTarget } from './explain.ts'
import type { Explain } from './types.ts'

// 合成の問（実際の試験問題の本文は使わない）
const single: ExplainTarget = { kind: 'single', direction: 'wrong', correct: 2, choices: [['a'], ['b'], ['c'], ['d']] }
const fill: ExplainTarget = { kind: 'fill', direction: 'right', correct: 3, choices: [['甲', '乙'], ['甲', '丙'], ['丁', '乙'], ['丁', '丙']] }
const combo: ExplainTarget = { kind: 'statements', direction: 'right', correct: 2, choices: [['①②'], ['①③④'], ['②③'], ['④']] }
const count: ExplainTarget = { kind: 'statements', direction: 'right', correct: 3, choices: [['1 つ'], ['2 つ'], ['3 つ'], ['4 つ']] }

const C = ['⑴', '⑵', '⑶', '⑷']
const S = ['①', '②', '③', '④']
const ex = (oks: boolean[], labels = C, extra: Partial<Explain> = {}): Explain => ({
  point: '論点の一文。',
  figures: [],
  checks: oks.map((ok, i) => ({ label: labels[i], ok, note: ok ? '正しい。' : '誤り。' })),
  ...extra,
})
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect x="1" y="1" width="98" height="48" fill="none" stroke="#333"/></svg>'

describe('explainProblems: 正答との一致', () => {
  it('適当でないものを選ぶ問: 正答肢だけ ×', () => {
    expect(explainProblems(ex([true, false, true, true]), single)).toEqual([])
    expect(explainProblems(ex([false, true, true, true]), single).join()).toContain('食い違う')
  })
  it('組合せ（fill）: 正答肢だけ ○', () => {
    expect(explainProblems(ex([false, false, true, false]), fill)).toEqual([])
    expect(explainProblems(ex([true, false, false, false]), fill).join()).toContain('食い違う')
  })
  it('statements の組合せ: ○ の集合が正答の組と一致', () => {
    expect(explainProblems(ex([true, false, true, true], S), combo)).toEqual([])
    expect(explainProblems(ex([true, true, false, false], S), combo).join()).toContain('食い違う')
  })
  it('statements の数: ○ の数が一致', () => {
    expect(explainProblems(ex([true, true, false, true], S), count)).toEqual([])
    expect(explainProblems(ex([true, false, false, true], S), count).join()).toContain('食い違う')
  })
  it('ラベルの取り違え（⑴ と ①）を検出', () => {
    expect(explainProblems(ex([true, false, true, true], S), single).join()).toContain('ラベル')
    expect(explainProblems(ex([true, false, true, true], C), combo).join()).toContain('ラベル')
  })
  it('肢チェックが4つでなければ不合格', () => {
    const e = ex([true, false, true, true])
    expect(explainProblems({ ...e, checks: e.checks.slice(0, 3) }, single).join()).toContain('3 個')
  })
})

describe('explainProblems: 分かりやすさの上限', () => {
  it('論点・一言の長さ、図の枚数', () => {
    expect(explainProblems(ex([true, false, true, true], C, { point: 'あ'.repeat(121) }), single).join()).toContain('論点が長い')
    const e = ex([true, false, true, true])
    e.checks[0].note = 'い'.repeat(81)
    expect(explainProblems(e, single).join()).toContain('一言が長い')
    const rule = { type: 'rule' as const, title: 't', rows: [{ label: 'a', value: 'b' }] }
    expect(explainProblems(ex([true, false, true, true], C, { figures: [rule, rule, rule] }), single).join()).toContain('3 枚')
  })
})

describe('explainProblems: 図の型', () => {
  const ok = [true, false, true, true]
  const run = (f: Explain['figures'][number]) => explainProblems(ex(ok, C, { figures: [f] }), single)
  it('正しい図は通る', () => {
    expect(run({ type: 'rule', title: '規定値', rows: [{ label: '締固め厚', value: '30cm 以下', trap: '50cm' }] })).toEqual([])
    expect(run({ type: 'flow', title: '手順', steps: ['a', 'b'], branches: [{ from: 1, label: 'NG', to: 'やり直し', bad: true }] })).toEqual([])
    expect(run({ type: 'compare', title: '比較', columns: ['長所', '短所'], rows: [{ label: '工法X', cells: ['速い', '高い'] }] })).toEqual([])
    expect(run({ type: 'svg', title: '断面', svg: SVG, alt: '長方形' })).toEqual([])
  })
  it('壊れた図を検出', () => {
    expect(run({ type: 'flow', title: '手順', steps: ['a'] }).join()).toContain('手順数')
    expect(run({ type: 'flow', title: '手順', steps: ['a', 'b'], branches: [{ from: 2, label: 'x', to: 'y' }] }).join()).toContain('範囲外')
    expect(run({ type: 'compare', title: '比較', columns: ['a', 'b'], rows: [{ label: 'x', cells: ['1'] }] }).join()).toContain('セル数')
    expect(run({ type: 'svg', title: '断面', svg: SVG, alt: '' }).join()).toContain('alt')
    expect(run({ type: 'rule', title: '', rows: [{ label: 'a', value: 'b' }] }).join()).toContain('題がない')
  })
})

describe('svgProblems', () => {
  it('安全な SVG は問題なし', () => expect(svgProblems(SVG)).toEqual([]))
  it('script・イベント属性・外部参照を弾く', () => {
    expect(svgProblems(SVG.replace('<rect', '<script>alert(1)</script><rect')).join()).toContain('使えない要素')
    expect(svgProblems(SVG.replace('<rect', '<rect onclick="x()"')).join()).toContain('イベント属性')
    expect(svgProblems(SVG.replace('<rect', '<a href="https://example.com"><rect')).join()).toContain('外部参照')
    expect(svgProblems(SVG.replace('fill="none"', 'fill="url(https://x/y)"')).join()).toContain('外部参照')
  })
  it('内部参照（#id）は許す', () => {
    const s = SVG.replace('<rect', '<defs><marker id="m"/></defs><path d="M0 0" marker-end="url(#m)"/><rect')
    expect(svgProblems(s)).toEqual([])
  })
  it('viewBox・xmlns がなければ不合格', () => {
    expect(svgProblems(SVG.replace(' viewBox="0 0 100 50"', '')).join()).toContain('viewBox')
    expect(svgProblems(SVG.replace(' xmlns="http://www.w3.org/2000/svg"', '')).join()).toContain('xmlns')
  })
  it('data URL に変換', () => {
    expect(svgDataUrl(SVG)).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/)
  })
})
