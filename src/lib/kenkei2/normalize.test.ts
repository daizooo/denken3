import { describe, expect, it } from 'vitest'
import { isBlank, parseAmount, parseSymbol } from './normalize.ts'

describe('parseAmount', () => {
  it('半角・全角・カンマ・¥・円をそろえる', () => {
    expect(parseAmount('1234')).toBe(1234)
    expect(parseAmount('1,234,000')).toBe(1234000)
    expect(parseAmount('￥１２，３４５')).toBe(12345)
    expect(parseAmount('¥ 500 円')).toBe(500)
    expect(parseAmount('5年')).toBe(5)
  })
  it('△・▲・-・− は負数', () => {
    expect(parseAmount('△3,000')).toBe(-3000)
    expect(parseAmount('▲3000')).toBe(-3000)
    expect(parseAmount('-3000')).toBe(-3000)
    expect(parseAmount('−3000')).toBe(-3000)
  })
  it('0 は 0（-0 にしない）', () => {
    expect(parseAmount('0')).toBe(0)
    expect(Object.is(parseAmount('-0'), 0)).toBe(true)
  })
  it('空欄・解釈不能は null', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('  ')).toBeNull()
    expect(parseAmount(undefined)).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('12a')).toBeNull()
    expect(parseAmount('1.2.3')).toBeNull()
  })
})

describe('parseSymbol', () => {
  it('全角・小文字・ローマ数字記号を英大文字1字にする', () => {
    expect(parseSymbol('A')).toBe('A')
    expect(parseSymbol('ｂ')).toBe('B')
    expect(parseSymbol('Ｘ')).toBe('X')
    expect(parseSymbol('Ⅽ')).toBe('C')   // 解答PDFにある U+216D
    expect(parseSymbol('Ⅿ')).toBe('M')
    expect(parseSymbol(' k ')).toBe('K')
  })
  it('1字でなければ null', () => {
    expect(parseSymbol('')).toBeNull()
    expect(parseSymbol('AB')).toBeNull()
    expect(parseSymbol('1')).toBeNull()
    expect(parseSymbol('あ')).toBeNull()
    expect(parseSymbol(null)).toBeNull()
  })
})

describe('isBlank', () => {
  it('空白だけは空欄', () => {
    expect(isBlank('')).toBe(true)
    expect(isBlank(' 　')).toBe(true)
    expect(isBlank('0')).toBe(false)
    expect(isBlank(undefined)).toBe(true)
  })
})
