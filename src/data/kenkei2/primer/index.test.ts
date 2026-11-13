import { describe, expect, it } from 'vitest'
import { gradeCard } from '../../../lib/kenkei2/cards.ts'
import { parseKk2Id } from '../index.ts'
import { buildPrimerSubject, parsePrimerId, PRIMER_TOPICS, primerIdOf, primerRowOf } from './index.ts'
import { PRIMER_SYMBOLS } from './symbols.ts'

const ids = PRIMER_TOPICS.flatMap(t => t.drills.map((_, i) => primerIdOf(t.id, i + 1)))

describe('入門のID', () => {
  it('一意で、過去問の ID とは区別できる', () => {
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(PRIMER_TOPICS.map(t => t.id)).size).toBe(PRIMER_TOPICS.length)
    for (const id of ids) {
      expect(id.startsWith('K2_')).toBe(true)
      expect(parseKk2Id(id)).toBeUndefined()
      expect(parsePrimerId(id)).toBeDefined()
    }
    expect(parsePrimerId('K2_39_1_1')).toBeUndefined()
  })
})

describe('ドリルの中身', () => {
  it('仕訳は貸借が一致し、記号は科目群にある', () => {
    const known = new Set(PRIMER_SYMBOLS.map(([s]) => s))
    for (const t of PRIMER_TOPICS) for (const d of t.drills) {
      if (d.kind !== 'journal') continue
      const sum = (ls: [string, number][]) => ls.reduce((a, [, v]) => a + v, 0)
      expect(sum(d.debit), `${t.id} ${d.title}`).toBe(sum(d.credit))
      for (const [s] of [...d.debit, ...d.credit]) expect(known.has(s)).toBe(true)
    }
  })
  it('科目群の記号は A〜Z で重複しない', () => {
    const s = PRIMER_SYMBOLS.map(([x]) => x)
    expect(new Set(s).size).toBe(s.length)
    expect(s.every(x => /^[A-Z]$/.test(x))).toBe(true)
  })
  it('正答を入れると満点で採点される（カードの形が過去問と同じ）', () => {
    for (const id of ids) {
      const row = primerRowOf(id)!
      const r = row.form_kind === 'journal'
        ? gradeCard(row, { answers: {}, journal: {
          debit: row.key.debit.map(l => ({ symbol: l.s, amount: String(l.a) })),
          credit: row.key.credit.map(l => ({ symbol: l.s, amount: String(l.a) })),
        } })
        : gradeCard(row, { answers: { v: row.form_kind === 'amount' ? String(row.key.value) : '' } })
      expect(r.rate, id).toBe(1)
    }
  })
  it('未知の ID は undefined', () => {
    expect(primerRowOf('K2_P_nothing_01')).toBeUndefined()
    expect(primerRowOf('K2_P_kihon_99')).toBeUndefined()
  })
})

describe('入門タブ', () => {
  it('章 ＝ テーマ（学習順）、問 ＝ ドリル', () => {
    const s = buildPrimerSubject(PRIMER_TOPICS)
    expect(s.name).toBe('入門')
    expect(s.chapters.map(c => c.name)).toEqual(PRIMER_TOPICS.map(t => t.name))
    expect(s.chapters.every(c => c.questions.length > 0 && c.subject === '入門')).toBe(true)
  })
})

describe('ノートの図解', () => {
  it('図解は中身があり、表は列数がそろい、強調位置は表の中にある', () => {
    let count = 0
    for (const t of PRIMER_TOPICS) for (const sec of t.sections) for (const f of sec.figures ?? []) {
      count++
      const where = `${t.id} ${sec.heading} ${f.kind}`
      if (f.kind === 'flow') expect(f.steps.length, where).toBeGreaterThanOrEqual(2)
      if (f.kind === 'funnel') { expect(f.sources.length, where).toBeGreaterThan(0); expect(f.hub.label, where).not.toBe('') }
      if (f.kind === 'sides') { expect(f.left.items.length, where).toBeGreaterThan(0); expect(f.right.items.length, where).toBeGreaterThan(0) }
      if (f.kind === 'taccount') for (const a of f.accounts) expect(a.debit.length + a.credit.length, where).toBeGreaterThan(0)
      if (f.kind === 'grid') {
        const cols = f.groups.reduce((n, g) => n + g.cols.length, 0)
        for (const r of f.rows) expect(r.length, where).toBe(cols)
        for (const [r, c] of f.hi ?? []) expect(f.rows[r]?.[c], where).toBeDefined()
      }
    }
    expect(count).toBeGreaterThan(0)
  })
})
