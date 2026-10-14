// 温存の解放判定（licensehub-expansion.md §8・§15）。
import { describe, expect, it } from 'vitest'
import { isAvailable, parseReleaseDates } from './holdout'

const none = { releaseDates: {} }

describe('isAvailable', () => {
  it('温存グループの無いものは常に出題できる', () => {
    expect(isAvailable(null, '2026-10-14', none)).toBe(true)
    expect(isAvailable(undefined, '2026-10-14', none)).toBe(true)
  })
  it('解放日が未設定なら解放しない', () => {
    expect(isAvailable('pilot-r7-rk', '2099-12-31', none)).toBe(false)
  })
  it('解放日の当日から解放する', () => {
    const s = { releaseDates: { 'gate-r8': '2027-05-31' } }
    expect(isAvailable('gate-r8', '2027-05-30', s)).toBe(false)
    expect(isAvailable('gate-r8', '2027-05-31', s)).toBe(true)
    expect(isAvailable('gate-r8', '2027-06-01', s)).toBe(true)
  })
  it('不正な日付は未設定と同じ（解放しない）', () => {
    expect(isAvailable('gate-r8', '2027-06-01', { releaseDates: { 'gate-r8': 'あした' } })).toBe(false)
    expect(isAvailable('gate-r8', '2027-06-01', { releaseDates: { 'gate-r8': '2027-13-45' } })).toBe(false)
  })
})

describe('parseReleaseDates', () => {
  it('日付として正しい値だけを残す', () => {
    expect(parseReleaseDates({ a: '2027-03-08', b: 3, c: 'x', d: null })).toEqual({ a: '2027-03-08' })
    expect(parseReleaseDates(null)).toEqual({})
    expect(parseReleaseDates(['2027-03-08'])).toEqual({})
  })
})
