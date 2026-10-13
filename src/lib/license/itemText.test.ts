// 肢の単体コピー（licensehub-expansion.md §6.3・§15）。
import { describe, expect, it } from 'vitest'
import { ITEM_ANSWER_GAP_LINES, formatItemForClipboard } from './itemText'

const item = { statement: '使用者は、労働者に対して…できる。', truth: false, explanation: '労基法第○条により…できない。' }

describe('formatItemForClipboard', () => {
  it('正解が25行目より前に現れない', () => {
    const lines = formatItemForClipboard('R07 労基 問1 A', item).split('\n')
    const answerLine = lines.findIndex(l => l.startsWith('【正解】'))
    expect(answerLine).toBeGreaterThanOrEqual(25)
    const head = lines.slice(0, 25).join('\n')
    expect(head).not.toContain('【正解】')
    expect(head).not.toContain('【解説】')
    expect(head).not.toContain(item.explanation)
    expect(head).not.toMatch(/×（誤り）|○（正しい）/)
  })
  it('問題文 → あなたの答え → 25行の空行 → 【正解】【解説】の順', () => {
    const text = formatItemForClipboard('T', item)
    expect(text.indexOf(item.statement)).toBeLessThan(text.indexOf('あなたの答え：'))
    expect(text).toContain(`あなたの答え：\n${'\n'.repeat(ITEM_ANSWER_GAP_LINES)}\n【正解】×（誤り）`)
    expect(text.endsWith(`【解説】${item.explanation}`)).toBe(true)
  })
  it('解説が無い肢は（解説なし）', () => {
    expect(formatItemForClipboard('T', { ...item, truth: true, explanation: null })).toContain('【正解】○（正しい）\n【解説】（解説なし）')
  })
})
