// 入門ノートの図解（経理・土木の全テーマ）の形を検査する。図解を足す人はこのファイルを触らなくてよい。
import { describe, expect, it } from 'vitest'
import { PRIMER_TOPICS } from './kenkei2/primer/index.ts'
import { D1_PRIMER_TOPICS } from './doboku1/primer/index.ts'
import type { PrimerFigure, PrimerSection } from './kenkei2/primer/types.ts'

const all: { where: string; sec: PrimerSection }[] = [
  ...PRIMER_TOPICS.flatMap(t => t.sections.map(sec => ({ where: `kenkei2/${t.id}`, sec }))),
  ...D1_PRIMER_TOPICS.flatMap(t => t.sections.map(sec => ({ where: `doboku1/${t.id}`, sec }))),
]

function check(f: PrimerFigure, where: string) {
  if (f.kind === 'flow') expect(f.steps.length, where).toBeGreaterThanOrEqual(2)
  if (f.kind === 'funnel') { expect(f.sources.length, where).toBeGreaterThan(0); expect(f.hub.label, where).not.toBe('') }
  if (f.kind === 'sides') { expect(f.left.items.length, where).toBeGreaterThan(0); expect(f.right.items.length, where).toBeGreaterThan(0) }
  if (f.kind === 'taccount') for (const a of f.accounts) expect(a.debit.length + a.credit.length, where).toBeGreaterThan(0)
  if (f.kind === 'grid') {
    const cols = f.groups.reduce((n, g) => n + g.cols.length, 0)
    for (const r of f.rows) expect(r.length, where).toBe(cols)
    for (const [r, c] of f.hi ?? []) expect(f.rows[r]?.[c], where).toBeDefined()
  }
  if (f.kind === 'draw') {
    expect(f.width, where).toBeGreaterThan(0)
    expect(f.height, where).toBeGreaterThan(0)
    expect(f.shapes.length, where).toBeGreaterThan(0)
    const inX = (x: number) => x >= 0 && x <= f.width
    const inY = (y: number) => y >= 0 && y <= f.height
    f.shapes.forEach((sh, i) => {
      const w = `${where} shape[${i}] ${sh.t}`
      if (sh.t === 'rect') { expect(inX(sh.x) && inX(sh.x + sh.w) && inY(sh.y) && inY(sh.y + sh.h), w).toBe(true) }
      if (sh.t === 'circle') { expect(inX(sh.cx - sh.r) && inX(sh.cx + sh.r) && inY(sh.cy - sh.r) && inY(sh.cy + sh.r), w).toBe(true) }
      if (sh.t === 'poly') { expect(sh.points.length, w).toBeGreaterThanOrEqual(3); expect(sh.points.every(([x, y]) => inX(x) && inY(y)), w).toBe(true) }
      if (sh.t === 'line') { expect(inX(sh.x1) && inX(sh.x2) && inY(sh.y1) && inY(sh.y2), w).toBe(true) }
      if (sh.t === 'text') { expect(inX(sh.x) && inY(sh.y), w).toBe(true); expect(sh.s, w).not.toBe('') }
    })
  }
}

describe('入門ノートの図解（全資格）', () => {
  it('どの図解も中身があり、座標は図の中に収まる', () => {
    for (const { where, sec } of all) for (const f of sec.figures ?? []) check(f, `${where} ${sec.heading} ${f.kind}`)
  })
})
