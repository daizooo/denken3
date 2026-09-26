import { describe, expect, it } from 'vitest'
import {
  distToSegment, hitStroke, pointInPolygon, simplifyPoints, strokeBBox, strokesInLasso, translateStroke,
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
