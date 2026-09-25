import { describe, expect, it } from 'vitest'
import type { QuestionAsset } from './assets'
import { GUTTER_X, panesOf, splitAtGutter, type Rect } from './viewerPages'

// 見開き画像1枚ぶんのアセット。既定は「左ページ=問題／右ページ=解答」の標準形。
function asset(over: Partial<QuestionAsset> = {}): QuestionAsset {
  return {
    storage_path: 'u/theory/dc/1.png',
    region: null,
    answer_x_pct: 50,
    answer_y_pct: 100,
    answer_right_y_pct: 0,
    region_y_pct: 50,
    sort: 0,
    question_start_pct: 0,
    explanation_end_pct: 100,
    ...over,
  }
}

// 1ページが画面幅いっぱいで描かれる ＝ どのページも横幅が半ページ相当（50%）を超えない。
// これを超える範囲は、画面幅に2ページ詰め込まれて文字が半分の大きさになる。
function widths(rects: Rect[]): number[] {
  return rects.map(r => r.x1 - r.x0)
}

describe('splitAtGutter', () => {
  it('見開き全体は左右のページに割れる', () => {
    expect(splitAtGutter({ x0: 0, x1: 100, y0: 0, y1: 100 })).toEqual([
      { x0: 0, x1: GUTTER_X, y0: 0, y1: 100 },
      { x0: GUTTER_X, x1: 100, y0: 0, y1: 100 },
    ])
  })

  it('片ページに収まる範囲はそのまま', () => {
    const r = { x0: 0, x1: 50, y0: 0, y1: 40 }
    expect(splitAtGutter(r)).toEqual([r])
  })

  it('綴じ目をわずかにまたぐだけの範囲は割らない（細すぎる断片を作らない）', () => {
    const r = { x0: 45, x1: 100, y0: 0, y1: 100 }
    expect(splitAtGutter(r)).toEqual([r])
  })
})

describe('panesOf', () => {
  it('標準の見開きは、問題1ページ・解答1ページ', () => {
    const a = [asset()]
    expect(panesOf(a, false)).toEqual([{ path: a[0].storage_path, rect: { x0: 0, x1: 50, y0: 0, y1: 100 } }])
    expect(panesOf(a, true)).toEqual([{ path: a[0].storage_path, rect: { x0: 50, x1: 100, y0: 0, y1: 100 } }])
  })

  it('見開き全面が問題（answer_x_pct=100）でも、1ページずつに分かれる', () => {
    const panes = panesOf([asset({ answer_x_pct: 100 })], false)
    expect(panes).toHaveLength(2)
    expect(widths(panes.map(p => p.rect))).toEqual([50, 50])
  })

  it('丸ごと解答のページも1ページずつに分かれる', () => {
    const panes = panesOf([asset({ answer_x_pct: 0, sort: 1 })], true)
    expect(panes).toHaveLength(2)
    expect(widths(panes.map(p => p.rect))).toEqual([50, 50])
  })

  it('複数枚にまたがる問題は、どのページも半ページ幅を超えない', () => {
    const assets = [
      asset({ storage_path: 'p0.png', sort: 0, answer_x_pct: 100 }), // 見開き全面が問題
      asset({ storage_path: 'p1.png', sort: 1, answer_x_pct: 0 }),   // 続きは丸ごと解答
    ]
    const q = panesOf(assets, false)
    const ans = panesOf(assets, true)
    expect(q.map(p => p.path)).toEqual(['p0.png', 'p0.png'])
    expect(ans.map(p => p.path)).toEqual(['p1.png', 'p1.png'])
    for (const w of [...widths(q.map(p => p.rect)), ...widths(ans.map(p => p.rect))]) {
      expect(w).toBeLessThanOrEqual(50)
    }
  })

  it('ページの並びは sort 昇順（読む順）', () => {
    const assets = [
      asset({ storage_path: 'second.png', sort: 2, answer_x_pct: 0 }),
      asset({ storage_path: 'first.png', sort: 1, answer_x_pct: 0 }),
    ]
    expect(panesOf(assets, true).map(p => p.path)).toEqual(['first.png', 'first.png', 'second.png', 'second.png'])
  })

  it('2問同居（region）の帯は保たれたまま左右に割れる', () => {
    const panes = panesOf([asset({ region: 'bottom', region_y_pct: 40, answer_x_pct: 100 })], false)
    expect(panes.map(p => p.rect)).toEqual([
      { x0: 0, x1: 50, y0: 40, y1: 100 },
      { x0: 50, x1: 100, y0: 40, y1: 100 },
    ])
  })
})
