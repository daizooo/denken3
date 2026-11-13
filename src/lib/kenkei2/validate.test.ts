import { describe, expect, it } from 'vitest'
import { validateCells, validateJournalKey, validatePointsTotal, validateSettlement } from './validate.ts'
import type { Cell, JournalKey, SettlementRow } from './types.ts'

describe('validateJournalKey', () => {
  const ok: JournalKey = { debit: [{ symbol: 'A', amount: 100 }], credit: [{ symbol: 'B', amount: 60 }, { symbol: 'C', amount: 40 }] }
  it('借貸一致なら問題なし', () => {
    expect(validateJournalKey(ok)).toEqual([])
    expect(validateJournalKey(ok, ['A', 'B', 'C'])).toEqual([])
  })
  it('借貸不一致・行なし・不正な金額/記号を検出する', () => {
    expect(validateJournalKey({ ...ok, credit: [{ symbol: 'B', amount: 60 }] }).join()).toContain('一致しない')
    expect(validateJournalKey({ debit: [], credit: ok.credit }).join()).toContain('借方の行がない')
    expect(validateJournalKey({ debit: [{ symbol: 'A', amount: 0 }], credit: [{ symbol: 'B', amount: 0 }] }).join()).toContain('正の整数')
    expect(validateJournalKey({ debit: [{ symbol: 'a', amount: 1 }], credit: [{ symbol: 'B', amount: 1 }] }).join()).toContain('記号が不正')
  })
  it('科目群に無い記号を検出する', () => {
    expect(validateJournalKey(ok, ['A', 'B']).join()).toContain('科目群に無い記号: C')
  })
})

describe('validateCells', () => {
  const c = (o: Partial<Cell>): Cell => ({ id: 'x', kind: 'amount', expected: 1, points: 2, ...o })
  it('正常な採点マス', () => {
    expect(validateCells([c({}), c({ id: 'y', kind: 'symbol', expected: 'B' })])).toEqual([])
  })
  it('id 重複・配点0・型違いを検出する', () => {
    expect(validateCells([c({}), c({})]).join()).toContain('重複')
    expect(validateCells([c({ points: 0 })]).join()).toContain('配点')
    expect(validateCells([c({ expected: 'A' })]).join()).toContain('数値でない')
    expect(validateCells([c({ kind: 'symbol', expected: 'AB' })]).join()).toContain('記号の正答が不正')
  })
})

describe('validatePointsTotal', () => {
  it('合計 100 を確かめる', () => {
    expect(validatePointsTotal([20, 12, 14, 24, 30].map((points, i) => ({ part: i + 1, points })))).toEqual([])
    expect(validatePointsTotal([{ part: 1, points: 20 }]).join()).toContain('100')
  })
})

describe('validateSettlement（架空の小さな精算表）', () => {
  // 試算表: 現金100 備品200 売上原価300 / 資本金100 売上500。整理: 現金 -20、売上原価 +20。純利益 180
  const rows = (): SettlementRow[] => [
    { name: '現金', tb: [100, 0], adj: [[], [20]], pl: [0, 0], bs: [80, 0] },
    { name: '備品', tb: [200, 0], adj: [[], []], pl: [0, 0], bs: [200, 0] },
    { name: '売上原価', tb: [300, 0], adj: [[20], []], pl: [320, 0], bs: [0, 0] },
    { name: '資本金', tb: [0, 100], adj: [[], []], pl: [0, 0], bs: [0, 100] },
    { name: '売上', tb: [0, 500], adj: [[], []], pl: [0, 500], bs: [0, 0] },
  ]
  it('整合していれば問題なし', () => {
    expect(validateSettlement(rows(), 180)).toEqual([])
  })
  it('1マスの取り違えを行・列・当期純利益で検出する', () => {
    const r = rows()
    r[0].bs = [90, 0]
    const p = validateSettlement(r, 180).join('\n')
    expect(p).toContain('行が合わない: 現金')
    expect(p).toContain('貸借対照表')
  })
  it('1つのマスに複数の金額が並ぶ整理記入は合計で見る', () => {
    const r = rows()
    r[2].adj = [[5, 15], []]
    expect(validateSettlement(r, 180)).toEqual([])
  })
  it('整理記入の借貸不一致を検出する', () => {
    const r = rows()
    r[0].adj = [[], [10]]
    r[0].bs = [90, 0]
    expect(validateSettlement(r, 180).join()).toContain('整理記入')
  })
  it('当期純利益が違えば検出する（損失は負）', () => {
    expect(validateSettlement(rows(), 181).join()).toContain('当期純利益')
  })
})
