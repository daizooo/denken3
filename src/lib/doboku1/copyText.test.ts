import { describe, expect, it } from 'vitest'
import {
  DBK_ANSWER_GAP_LINES, DBK_BATCH_SESSION_KEY, clampDbkBatchSize, formatDbkBatch, formatDbkForClipboard,
  loadDbkBatch, pickDbkBatch, saveDbkBatch,
} from './copyText.ts'
import { BATCH_SESSION_KEY, newBatchSession } from '../license/batchSession.ts'

const q = {
  year: 'R08', paper: 'A' as const, q_no: 3, stem: '次の記述のうち、適当でないものはどれか。',
  statements: [], choice_header: [], choices: [['ア'], ['イ'], ['ウ'], ['エ']], has_figure: false,
  correct: 3, explain: { point: '論点', figures: [], checks: [{ label: '⑶', ok: false, note: '誤り' }], basis: '示方書' },
}

function memStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

describe('formatDbkForClipboard', () => {
  it('答えは25行の空行の下に置く', () => {
    const t = formatDbkForClipboard(q)
    const [before, after] = t.split('\n'.repeat(DBK_ANSWER_GAP_LINES))
    expect(before).toContain('⑷ エ')
    expect(before).not.toContain('【正答】')
    expect(after).toContain('【正答】⑶')
    expect(after).toContain('根拠: 示方書')
  })
  it('表形式・①〜④・図を書き出す', () => {
    const t = formatDbkForClipboard({ ...q, statements: ['a', 'b'], choice_header: ['イ', 'ロ'], choices: [['x', 'y']], has_figure: true, explain: null })
    expect(t).toContain('① a')
    expect(t).toContain('イ　／　ロ')
    expect(t).toContain('⑴ x　／　y')
    expect(t).toContain('図あり')
    expect(t).toContain('（解説は準備中）')
  })
})

describe('formatDbkBatch', () => {
  it('正答・解説を含めず、番号と記入欄を付ける', () => {
    const t = formatDbkBatch([q, { ...q, q_no: 4 }], '2026-11-10 09:00')
    expect(t).toContain('2問')
    expect(t).toContain('1. （R08 A No.3）')
    expect(t).toContain('2. （R08 A No.4）')
    expect(t).not.toContain('正答')
    expect(t).not.toContain('論点')
    expect(t.trimEnd().endsWith('2.')).toBe(true)
  })
})

describe('pickDbkBatch / clamp', () => {
  it('図のある問・重複を飛ばして先頭から n 件', () => {
    const list = [{ id: 'a', has_figure: true }, { id: 'b', has_figure: false }, { id: 'b', has_figure: false }, { id: 'c', has_figure: false }, { id: 'd', has_figure: false }]
    expect(pickDbkBatch(list, 2)).toEqual(['b', 'c'])
  })
  it('3〜20 に丸める', () => {
    expect(clampDbkBatchSize(1)).toBe(3)
    expect(clampDbkBatchSize(99)).toBe(20)
    expect(clampDbkBatchSize(NaN)).toBe(5)
  })
})

describe('組の保持', () => {
  it('社労士の組と別キーに保存し、別ユーザーの組は破棄する', () => {
    const st = memStorage()
    const s = newBatchSession(['D1_R08_A_01'], 'u1', 'doboku1', new Date('2026-11-10T00:00:00Z'))
    expect(saveDbkBatch(st, s)).toBe(true)
    expect(st.m.has(BATCH_SESSION_KEY)).toBe(false)
    expect(loadDbkBatch(st, 'u1')).toEqual(s)
    expect(loadDbkBatch(st, 'u2')).toBeNull()
    expect(st.m.has(DBK_BATCH_SESSION_KEY)).toBe(false)
  })
  it('壊れた値は null', () => {
    const st = memStorage()
    st.setItem(DBK_BATCH_SESSION_KEY, '{')
    expect(loadDbkBatch(st, 'u1')).toBeNull()
  })
})
