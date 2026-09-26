import { describe, expect, it } from 'vitest'
import {
  distToSegment, eraseStroke, hitStroke, pathLength, pointInPolygon, simplifyPoints,
  strokeBBox, strokesInLasso, translateStroke,
  type NoteStroke,
} from './noteModel'

const line = (id: string, pts: [number, number][], width = 0.004): NoteStroke =>
  ({ id, color: '#000', width, points: pts.map(([x, y]) => ({ x, y })) })

describe('strokeBBox', () => {
  it('太さのぶんだけ外へ膨らませた外接矩形を返す', () => {
    const b = strokeBBox(line('a', [[0.2, 0.3], [0.5, 0.1]], 0.02))
    expect(b.x0).toBeCloseTo(0.19)
    expect(b.y0).toBeCloseTo(0.09)
    expect(b.x1).toBeCloseTo(0.51)
    expect(b.y1).toBeCloseTo(0.31)
  })
})

describe('distToSegment', () => {
  it('線分の内側へ落ちる点は垂線の距離', () => {
    expect(distToSegment(0.5, 0.2, 0, 0, 1, 0)).toBeCloseTo(0.2)
  })
  it('線分の外側の点は端点までの距離', () => {
    expect(distToSegment(2, 0, 0, 0, 1, 0)).toBeCloseTo(1)
  })
  it('長さ0の線分は点との距離に落ちる', () => {
    expect(distToSegment(0, 3, 1, 3, 1, 3)).toBeCloseTo(1)
  })
})

describe('hitStroke', () => {
  const s = line('a', [[0.2, 0.5], [0.8, 0.5]], 0.01)
  it('消しゴムの円が線に届けば当たり', () => {
    expect(hitStroke(s, 0.5, 0.51, 0.01)).toBe(true)
  })
  it('届かなければ外れ', () => {
    expect(hitStroke(s, 0.5, 0.7, 0.01)).toBe(false)
  })
  it('線の端より外は外れ', () => {
    expect(hitStroke(s, 0.05, 0.5, 0.01)).toBe(false)
  })
  it('置いた点だけの線も消せる', () => {
    expect(hitStroke(line('p', [[0.4, 0.4]], 0.01), 0.405, 0.4, 0.01)).toBe(true)
  })
})

describe('pointInPolygon', () => {
  const box = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
  it('内側', () => expect(pointInPolygon(0.5, 0.5, box)).toBe(true))
  it('外側', () => expect(pointInPolygon(1.5, 0.5, box)).toBe(false))
})

describe('strokesInLasso', () => {
  const strokes = [line('in', [[0.2, 0.2], [0.3, 0.3]]), line('out', [[0.9, 0.9], [0.95, 0.95]])]
  const poly = [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.1, y: 0.5 }]
  it('囲みの中に点を持つ線だけを選ぶ', () => {
    expect(strokesInLasso(strokes, poly)).toEqual(['in'])
  })
  it('3点未満の囲みでは何も選ばない', () => {
    expect(strokesInLasso(strokes, poly.slice(0, 2))).toEqual([])
  })
})

describe('translateStroke', () => {
  it('全点を平行移動し、元の線は変えない', () => {
    const s = line('a', [[0.1, 0.1], [0.2, 0.2]])
    const moved = translateStroke(s, 0.05, -0.05)
    expect(moved.points[0].x).toBeCloseTo(0.15)
    expect(moved.points[0].y).toBeCloseTo(0.05)
    expect(moved.points[1].x).toBeCloseTo(0.25)
    expect(moved.points[1].y).toBeCloseTo(0.15)
    expect(s.points[0]).toEqual({ x: 0.1, y: 0.1 })
  })
})

describe('simplifyPoints', () => {
  it('ほぼ直線上の中間点を落とし、端点は残す', () => {
    const pts = [{ x: 0, y: 0 }, { x: 0.25, y: 0.0001 }, { x: 0.5, y: 0 }, { x: 1, y: 0 }]
    expect(simplifyPoints(pts, 0.001)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }])
  })
  it('形を決めている点は残す', () => {
    const pts = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0 }]
    expect(simplifyPoints(pts, 0.001)).toEqual(pts)
  })
  it('2点以下・許容量0はそのまま', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }]
    expect(simplifyPoints(pts, 0.01)).toBe(pts)
    const three = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 1, y: 0 }]
    expect(simplifyPoints(three, 0)).toBe(three)
  })
  it('筆圧つきの点も点オブジェクトのまま残る', () => {
    const pts = [{ x: 0, y: 0, p: 0.2 }, { x: 0.5, y: 0.5, p: 0.9 }, { x: 1, y: 0, p: 0.3 }]
    expect(simplifyPoints(pts, 0.001)).toEqual(pts)
  })
})

describe('eraseStroke（部分消し）', () => {
  // 太さ0に近い水平線。半径の計算に太さが混ざらないようにして端点を見る。
  const h = (id = 'a') => line(id, [[0, 0.5], [1, 0.5]], 0)

  it('触れていなければ同じ線をそのまま返す（参照も変えない）', () => {
    const s = h()
    const out = eraseStroke(s, 0.5, 0.9, 0.1)
    expect(out).toHaveLength(1)
    expect(out[0]).toBe(s)
  })

  it('真ん中を消すと手前と奥の2本に分かれる', () => {
    const out = eraseStroke(h(), 0.5, 0.5, 0.1)
    expect(out).toHaveLength(2)
    expect(out[0].points[0].x).toBeCloseTo(0)
    expect(out[0].points[1].x).toBeCloseTo(0.4)
    expect(out[1].points[0].x).toBeCloseTo(0.6)
    expect(out[1].points[1].x).toBeCloseTo(1)
  })

  it('分かれた断片は別IDになる（元IDの重複を作らない）', () => {
    const out = eraseStroke(h('orig'), 0.5, 0.5, 0.1)
    expect(new Set(out.map(s => s.id)).size).toBe(2)
    expect(out.map(s => s.id)).not.toContain('orig')
    expect(out[0].color).toBe('#000')
  })

  it('端を消すと残りは1本（消した側が短くなる）', () => {
    const out = eraseStroke(h(), 0, 0.5, 0.2)
    expect(out).toHaveLength(1)
    expect(out[0].points[0].x).toBeCloseTo(0.2)
    expect(out[0].points[1].x).toBeCloseTo(1)
  })

  it('線を覆う大きさなら何も残らない', () => {
    expect(eraseStroke(h(), 0.5, 0.5, 2)).toEqual([])
  })

  it('消し残りの切れ端（ごく短い断片）は捨てる', () => {
    // 左端ぎりぎりまで消すと、左に長さ0.001の切れ端が残る＝捨てられて右の1本だけになる。
    const out = eraseStroke(h(), 0.4, 0.5, 0.399)
    expect(out).toHaveLength(1)
    expect(out[0].points[0].x).toBeCloseTo(0.799)
    expect(out[0].points[1].x).toBeCloseTo(1)
  })

  it('太さのぶんだけ広く消える（見た目と判定を合わせる）', () => {
    const thick = line('t', [[0, 0.5], [1, 0.5]], 0.1)
    const out = eraseStroke(thick, 0.5, 0.5, 0.1)
    // 半径0.1 + 太さの半分0.05 = 0.15 ぶん抜ける。
    expect(out[0].points[1].x).toBeCloseTo(0.35)
    expect(out[1].points[0].x).toBeCloseTo(0.65)
  })

  it('折れ線は消した所だけ抜け、形は保たれる', () => {
    const s = line('v', [[0, 0], [0.5, 0.5], [1, 0]], 0)
    const out = eraseStroke(s, 0.5, 0.5, 0.1)
    expect(out).toHaveLength(2)
    expect(out[0].points[0]).toEqual({ x: 0, y: 0 })
    expect(out[1].points[out[1].points.length - 1]).toEqual({ x: 1, y: 0 })
    expect(pathLength(out[0].points)).toBeGreaterThan(0)
  })

  it('置いた点は触れたときだけ消える', () => {
    const dot = line('d', [[0.5, 0.5]], 0.01)
    expect(eraseStroke(dot, 0.5, 0.5, 0.01)).toEqual([])
    expect(eraseStroke(dot, 0.9, 0.5, 0.01)).toHaveLength(1)
  })

  it('筆圧は切り口で補間される', () => {
    const s: NoteStroke = { id: 'p', color: '#000', width: 0, points: [{ x: 0, y: 0.5, p: 0 }, { x: 1, y: 0.5, p: 1 }] }
    const out = eraseStroke(s, 0.5, 0.5, 0.1)
    expect(out[0].points[1].p).toBeCloseTo(0.4)
    expect(out[1].points[0].p).toBeCloseTo(0.6)
  })
})

describe('pathLength', () => {
  it('線分の長さを足し合わせる', () => {
    expect(pathLength([{ x: 0, y: 0 }, { x: 0.3, y: 0 }, { x: 0.3, y: 0.4 }])).toBeCloseTo(0.7)
  })
})
