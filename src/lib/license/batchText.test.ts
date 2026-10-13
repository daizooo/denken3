// 一括コピーのテキスト（licensehub-expansion.md §6.3・§15 受け入れ7）。
import { describe, expect, it } from 'vitest'
import {
  BATCH_DEFAULT, BATCH_MAX, BATCH_MIN, clampBatchSize, formatBatchCreatedAt, formatBatchForClipboard,
} from './batchText'
import { truthLabel } from './itemText'

const items = [
  { statement: '使用者は、労働者に対して…できる。', truth: false, explanation: '労基法第○条により…できない。' },
  { statement: '事業者は、安全衛生管理体制を…しなければならない。', truth: true, explanation: '安衛法第△条のとおり。' },
  { statement: '賃金は、通貨で…支払わなければならない。', truth: true, explanation: '' },
]

describe('formatBatchForClipboard', () => {
  it('truth・解説・【正解】が出力に含まれない', () => {
    // 呼び出し側が誤って ItemBody 全体を渡しても、答えは出ない
    const text = formatBatchForClipboard(items, '2026-10-13 09:00')
    expect(text).not.toContain('【正解】')
    expect(text).not.toContain('【解説】')
    expect(text).not.toContain('正解')
    expect(text).not.toContain('解説')
    expect(text).not.toContain(truthLabel(true))
    expect(text).not.toContain(truthLabel(false))
    expect(text).not.toContain('true')
    expect(text).not.toContain('false')
    for (const it of items) {
      if (it.explanation) expect(text).not.toContain(it.explanation)
    }
  })

  it('番号付きで全肢の本文を順に含み、番号だけの記入欄で終わる', () => {
    const text = formatBatchForClipboard(items, '2026-10-13 09:00')
    const lines = text.split('\n')
    expect(lines[0]).toContain('3肢')
    const pos = items.map(it => text.indexOf(it.statement))
    expect(pos.every(p => p > 0)).toBe(true)
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
    expect(lines.indexOf('1.')).toBeLessThan(lines.indexOf('2.'))
    expect(lines.slice(-3)).toEqual(['1. ', '2. ', '3. '])
  })
})

describe('clampBatchSize', () => {
  it('5〜30 に丸め、数でなければ既定10', () => {
    expect(clampBatchSize(1)).toBe(BATCH_MIN)
    expect(clampBatchSize(100)).toBe(BATCH_MAX)
    expect(clampBatchSize(12.4)).toBe(12)
    expect(clampBatchSize(Number.NaN)).toBe(BATCH_DEFAULT)
    expect(BATCH_DEFAULT).toBe(10)
  })
})

describe('formatBatchCreatedAt', () => {
  it('JST の YYYY-MM-DD HH:MM、解釈できなければそのまま', () => {
    expect(formatBatchCreatedAt('2026-10-13T00:05:00.000Z')).toBe('2026-10-13 09:05')
    expect(formatBatchCreatedAt('2026-10-13T15:30:00.000Z')).toBe('2026-10-14 00:30')
    expect(formatBatchCreatedAt('x')).toBe('x')
  })
})
