// 温存の解放判定（licensehub-expansion.md §8・§15）。本物の年度（R6・R7・R8）は解放日まで模試に選べない。
import { describe, expect, it } from 'vitest'
import {
  holdoutGroupLabel, isAvailable, isPaperAvailable, mockHoldoutGroupOf, paperHoldoutGroups, parseReleaseDates,
} from './holdout'

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

describe('模試の年度の温存', () => {
  it('フィクスチャの年度は模試グループを持たない', () => {
    expect(mockHoldoutGroupOf('R99')).toBeNull()
    expect(mockHoldoutGroupOf('R98')).toBeNull()
  })
  it('本物の年度は模試グループを持つ（R08 は gate-r8）', () => {
    expect(mockHoldoutGroupOf('R06')).toBe('mock-r06')
    expect(mockHoldoutGroupOf('R07')).toBe('mock-r07')
    expect(mockHoldoutGroupOf('R08')).toBe('gate-r8')
  })
  it('R07 の択一は模試グループとパイロットの両方の解放が要る', () => {
    expect(paperHoldoutGroups('R07', [null, 'pilot-r7-rk', null, 'pilot-r7-rk'])).toEqual(['mock-r07', 'pilot-r7-rk'])
    expect(paperHoldoutGroups('R08', ['gate-r8', 'gate-r8'])).toEqual(['gate-r8'])
  })

  const today = '2026-10-14'
  it('本物の年度（R6・R7・R8）は解放日まで選べない', () => {
    expect(isPaperAvailable('R06', [null], today, none)).toBe(false)
    expect(isPaperAvailable('R07', [null, 'pilot-r7-rk'], today, none)).toBe(false)
    expect(isPaperAvailable('R07', [null], today, none)).toBe(false)
    expect(isPaperAvailable('R08', ['gate-r8'], today, none)).toBe(false)
    // 解放日が先の日付でも選べない
    const later = { releaseDates: { 'mock-r06': '2027-03-08', 'mock-r07': '2027-03-08', 'pilot-r7-rk': '2026-11-20', 'gate-r8': '2027-05-31' } }
    expect(isPaperAvailable('R06', [null], today, later)).toBe(false)
    expect(isPaperAvailable('R07', [null, 'pilot-r7-rk'], today, later)).toBe(false)
    expect(isPaperAvailable('R08', ['gate-r8'], today, later)).toBe(false)
  })
  it('フィクスチャの年度は今日から選べる', () => {
    expect(isPaperAvailable('R99', [null], today, none)).toBe(true)
  })
  it('解放日を過ぎると選べる。R07 はパイロットが未解放なら択一を選べない', () => {
    const s = { releaseDates: { 'mock-r06': '2027-03-08', 'mock-r07': '2027-03-08', 'gate-r8': '2027-05-31' } }
    expect(isPaperAvailable('R06', [null], '2027-03-08', s)).toBe(true)
    expect(isPaperAvailable('R07', [null], '2027-03-08', s)).toBe(true)                 // 選択式（パイロット対象外）
    expect(isPaperAvailable('R07', [null, 'pilot-r7-rk'], '2027-03-08', s)).toBe(false) // 択一（パイロット未設定）
    expect(isPaperAvailable('R08', ['gate-r8'], '2027-05-31', s)).toBe(true)
  })
})

describe('holdoutGroupLabel', () => {
  it('表示名', () => {
    expect(holdoutGroupLabel('mock-r06')).toBe('R6 本番形式模試（通し演習）')
    expect(holdoutGroupLabel('gate-r8')).toContain('R8')
    expect(holdoutGroupLabel('unknown')).toBe('unknown')
  })
})
