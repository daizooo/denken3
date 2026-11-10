import { describe, expect, it } from 'vitest'
import { figureSrc, fitSize, MAX_BASE64, splitDataUrl } from './figure.ts'

describe('fitSize', () => {
  it('長辺を 1280 に縮め、縦横比を保つ', () => {
    expect(fitSize(2560, 1440)).toEqual({ width: 1280, height: 720 })
    expect(fitSize(1000, 3000)).toEqual({ width: 427, height: 1280 })
  })
  it('小さい画像は拡大しない', () => expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 }))
  it('不正な寸法は例外', () => expect(() => fitSize(0, 10)).toThrow())
})

describe('splitDataUrl', () => {
  it('JPEG を分解する', () => {
    expect(splitDataUrl('data:image/jpeg;base64,QUJD')).toEqual({ mime: 'image/jpeg', data: 'QUJD' })
  })
  it('対象外の形式・大きすぎる画像を弾く', () => {
    expect(splitDataUrl('data:image/gif;base64,QUJD')).toHaveProperty('error')
    expect(splitDataUrl('data:image/svg+xml;base64,QUJD')).toHaveProperty('error')
    expect(splitDataUrl('data:image/jpeg;base64,' + 'A'.repeat(MAX_BASE64 + 4))).toHaveProperty('error')
    expect(splitDataUrl('not a data url')).toHaveProperty('error')
  })
  it('表示用に戻す', () => expect(figureSrc('image/png', 'QUJD')).toBe('data:image/png;base64,QUJD'))
})
