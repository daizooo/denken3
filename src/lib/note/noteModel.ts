// 計算用ノートのデータ構造と幾何計算（純関数のみ）。
//
// 描画・入力・保存はそれぞれ別ファイルに置き、ここは「線の集まり」をどう表すかと、
// 消しゴム・投げ縄選択の当たり判定だけを担う。React にも DOM にも依存しないので、
// 判定のバグはここのテストで閉じ込められる。
//
// 座標系（論理単位）:
//   x, y はいずれも「描画領域の幅」を 1 とした比で持つ。
//   ・x は 0〜1、y は 0〜(高さ/幅)。縦横とも同じ基準で割るため縦横比は崩れない。
//   ・端末やウィンドウ幅が変わっても、同じノートが相対的に同じ形で再現される
//     （px で持つと、スマホで書いたノートが PC で開いたときに崩れる）。
//   ・太さ（width）も同じ基準の比で持つ。

export type NoteTool = 'pen' | 'eraser' | 'line' | 'lasso'

export interface NotePoint {
  x: number
  y: number
  /** 筆圧 0〜1。スタイラスのみ有効で、指・マウスでは undefined（＝一定の太さ）。 */
  p?: number
}

export interface NoteStroke {
  id: string
  /** CSS の色文字列。 */
  color: string
  /** 論理単位の太さ（描画領域の幅に対する比）。 */
  width: number
  /** 2点以上。直線ツールの線はちょうど2点になる。 */
  points: NotePoint[]
}

export interface NoteDoc {
  /** 保存形式の版。将来の移行のために持つ（読めない版は空ノートへ落とす）。 */
  v: 1
  strokes: NoteStroke[]
}

export interface NoteBox { x0: number; y0: number; x1: number; y1: number }

export function emptyDoc(): NoteDoc {
  return { v: 1, strokes: [] }
}

/** 衝突しない線ID。crypto.randomUUID が無い環境でも動かす。 */
export function newStrokeId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch { /* 下の簡易採番に落とす */ }
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function strokeBBox(stroke: NoteStroke): NoteBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const pt of stroke.points) {
    if (pt.x < x0) x0 = pt.x
    if (pt.y < y0) y0 = pt.y
    if (pt.x > x1) x1 = pt.x
    if (pt.y > y1) y1 = pt.y
  }
  // 太さのぶん外へ膨らませる（見た目の当たりと判定を合わせる）。
  const r = stroke.width / 2
  return { x0: x0 - r, y0: y0 - r, x1: x1 + r, y1: y1 + r }
}

/** 点と線分の距離。消しゴムの当たり判定の土台。 */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  // 長さ0の線分（点）は点同士の距離に落とす。
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/** 消しゴムの円（中心 px,py・半径 r）が線に触れているか。 */
export function hitStroke(stroke: NoteStroke, px: number, py: number, r: number): boolean {
  const reach = r + stroke.width / 2
  const box = strokeBBox(stroke)
  // まず外接矩形で粗く落とす（線が増えても消しゴムが重くならないように）。
  if (px < box.x0 - reach || px > box.x1 + reach || py < box.y0 - reach || py > box.y1 + reach) return false
  const pts = stroke.points
  if (pts.length === 1) return Math.hypot(px - pts[0].x, py - pts[0].y) <= reach
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(px, py, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= reach) return true
  }
  return false
}

/** 多角形の内外判定（交差数法）。投げ縄選択に使う。 */
export function pointInPolygon(px: number, py: number, poly: NotePoint[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    const crosses = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/**
 * 投げ縄の内側にある線のIDを返す。
 * 1点でも内側に入っていれば選ぶ（GoodNotes と同様、囲みきれていなくても掴める）。
 */
export function strokesInLasso(strokes: NoteStroke[], poly: NotePoint[]): string[] {
  if (poly.length < 3) return []
  const ids: string[] = []
  for (const s of strokes) {
    if (s.points.some(pt => pointInPolygon(pt.x, pt.y, poly))) ids.push(s.id)
  }
  return ids
}

export function translateStroke(stroke: NoteStroke, dx: number, dy: number): NoteStroke {
  return { ...stroke, points: stroke.points.map(pt => ({ ...pt, x: pt.x + dx, y: pt.y + dy })) }
}

/**
 * 線の間引き（Ramer–Douglas–Peucker）。手書きの点列は1本で数百点になるため、
 * 見た目が変わらない範囲で落として保存量と再描画の負荷を下げる。
 * 端点は必ず残す。tol は論理単位（幅=1）。
 */
export function simplifyPoints(points: NotePoint[], tol: number): NotePoint[] {
  if (points.length <= 2 || tol <= 0) return points
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  // 再帰ではなくスタックで回す（長い線でスタックを溢れさせない）。
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [lo, hi] = stack.pop() as [number, number]
    if (hi - lo < 2) continue
    let far = -1
    let maxD = -1
    for (let i = lo + 1; i < hi; i++) {
      const d = distToSegment(points[i].x, points[i].y, points[lo].x, points[lo].y, points[hi].x, points[hi].y)
      if (d > maxD) { maxD = d; far = i }
    }
    if (maxD > tol && far > 0) {
      keep[far] = 1
      stack.push([lo, far], [far, hi])
    }
  }
  const out: NotePoint[] = []
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i])
  return out
}

/** 点の列の長さ（論理単位）。消し残りの切れ端を捨てる判定に使う。 */
export function pathLength(points: NotePoint[]): number {
  let sum = 0
  for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  return sum
}

// 消したあとに残る切れ端の下限。これ未満は点にしか見えないので捨てる。
const MIN_FRAGMENT = 0.003

/**
 * 線分 a→b のうち円（中心 c・半径 R）の内側に入る区間 [t0,t1]（0〜1）。交わらなければ null。
 * 線分が丸ごと内側なら [0,1]、掠めるだけ（接する）なら null。
 */
function circleInterval(
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number, R: number,
): [number, number] | null {
  const dx = bx - ax
  const dy = by - ay
  const fx = ax - cx
  const fy = ay - cy
  const A = dx * dx + dy * dy
  if (A === 0) return fx * fx + fy * fy <= R * R ? [0, 1] : null
  const B = 2 * (fx * dx + fy * dy)
  const C = fx * fx + fy * fy - R * R
  const disc = B * B - 4 * A * C
  if (disc < 0) return null
  const sq = Math.sqrt(disc)
  let t0 = (-B - sq) / (2 * A)
  let t1 = (-B + sq) / (2 * A)
  if (t1 < 0 || t0 > 1) return null
  t0 = Math.max(0, t0)
  t1 = Math.min(1, t1)
  if (t1 <= t0) return null
  return [t0, t1]
}

/** 2点の間を t で内分する（筆圧も一緒に補間する）。 */
function lerpPoint(a: NotePoint, b: NotePoint, t: number): NotePoint {
  const pt: NotePoint = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  if (a.p != null && b.p != null) pt.p = a.p + (b.p - a.p) * t
  else if (a.p != null || b.p != null) pt.p = a.p ?? b.p
  return pt
}

/**
 * 消しゴム（中心 cx,cy・半径 r の円）で線を部分的に消す（GoodNotes と同じ挙動）。
 * 触れた部分だけを抜き、残った手前・奥をそれぞれ別の線として返す
 * ――「1本まるごと消える」と、長い分数の横線や補助線を少しだけ直したいときに困る。
 *
 * 返り値:
 *   ・触れていない  → [stroke] そのもの（同一参照。呼び出し側の「変化なし」判定に使う）
 *   ・消し尽くした  → []
 *   ・部分的に消した → 残った断片（新しいID）
 */
export function eraseStroke(stroke: NoteStroke, cx: number, cy: number, r: number): NoteStroke[] {
  // 見た目の太さのぶん、線は判定より外まで描かれている。半径に足して見た目と合わせる。
  const R = r + stroke.width / 2
  const pts = stroke.points
  if (pts.length === 1) return Math.hypot(pts[0].x - cx, pts[0].y - cy) <= R ? [] : [stroke]

  const frags: NotePoint[][] = []
  let cur: NotePoint[] = []
  let cut = false
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const iv = circleInterval(a.x, a.y, b.x, b.y, cx, cy, R)
    if (!iv) {
      // この線分はまるごと残る。
      if (cur.length === 0) cur.push(a)
      cur.push(b)
      continue
    }
    cut = true
    const [t0, t1] = iv
    // 円に入るまで（手前）は残す。
    if (t0 > 0) {
      if (cur.length === 0) cur.push(a)
      cur.push(lerpPoint(a, b, t0))
    }
    if (cur.length >= 2) frags.push(cur)
    // 円を出たあと（奥）から次の断片を始める。
    cur = t1 < 1 ? [lerpPoint(a, b, t1), b] : []
  }
  if (cur.length >= 2) frags.push(cur)
  if (!cut) return [stroke]
  return frags
    .filter(f => pathLength(f) >= MIN_FRAGMENT)
    .map(f => ({ ...stroke, id: newStrokeId(), points: f }))
}

/** 線を「囲みの内側」と「外側」に切り分けた結果。 */
export interface ClipResult {
  /** 囲みの内側に入っていた部分（切り取り・移動の対象）。 */
  inside: NoteStroke[]
  /** 外側に残る部分。 */
  outside: NoteStroke[]
}

/**
 * 線分 a→b が多角形の辺と交わる位置（線分上の 0〜1）をすべて返す。
 * 多角形の頂点ちょうどで交わる場合に同じ点を二重に拾いうるが、
 * 下の clipStrokeByPolygon では中点で内外を判定するため、余分な切れ目があっても結果は変わらない。
 */
function polygonCrossings(
  ax: number, ay: number, bx: number, by: number, poly: NotePoint[],
): number[] {
  const rx = bx - ax
  const ry = by - ay
  const ts: number[] = []
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cx = poly[j].x, cy = poly[j].y
    const sx = poly[i].x - cx, sy = poly[i].y - cy
    const denom = rx * sy - ry * sx
    // 平行（または長さ0）の辺は交点なしとして扱う。
    if (Math.abs(denom) < 1e-12) continue
    const t = ((cx - ax) * sy - (cy - ay) * sx) / denom
    const u = ((cx - ax) * ry - (cy - ay) * rx) / denom
    if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t)
  }
  return ts.sort((p, q) => p - q)
}

/**
 * 投げ縄（多角形）で線を切り分ける。囲みの境界で線を割り、
 * 内側に入った部分だけを inside として返す（GoodNotes の投げ縄と同じ挙動）。
 *
 * 「線に少しでも触れていたら1本まるごと選択」だと、長い補助線や式の一部だけを
 * 動かしたいときに巻き添えが出るため、境界でちょうど切る。
 *
 * 丸ごと内側／丸ごと外側の線は、同じ参照のまま返す（呼び出し側の「変化なし」判定に使う）。
 */
export function clipStrokeByPolygon(stroke: NoteStroke, poly: NotePoint[]): ClipResult {
  if (poly.length < 3) return { inside: [], outside: [stroke] }
  const pts = stroke.points
  if (pts.length === 1) {
    return pointInPolygon(pts[0].x, pts[0].y, poly)
      ? { inside: [stroke], outside: [] }
      : { inside: [], outside: [stroke] }
  }

  // 内／外が切り替わるところで区切りながら、点列を断片に貯めていく。
  const inside: NotePoint[][] = []
  const outside: NotePoint[][] = []
  let cur: NotePoint[] = []
  let curInside: boolean | null = null
  const flush = () => {
    if (cur.length >= 2 && curInside !== null) (curInside ? inside : outside).push(cur)
    cur = []
  }

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const ts = polygonCrossings(a.x, a.y, b.x, b.y, poly)
    let from = 0
    for (const t of [...ts, 1]) {
      if (t <= from) continue
      const p0 = from === 0 ? a : lerpPoint(a, b, from)
      const p1 = t === 1 ? b : lerpPoint(a, b, t)
      // 小片の内外は中点で決める（端点は境界上にあるため判定に使えない）。
      const isIn = pointInPolygon((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, poly)
      if (curInside !== isIn) {
        flush()
        curInside = isIn
        cur = [p0]
      }
      cur.push(p1)
      from = t
    }
  }
  flush()

  // 一方に寄り切った場合は元の線をそのまま返す（IDを変えず、履歴も汚さない）。
  if (inside.length === 0) return { inside: [], outside: [stroke] }
  if (outside.length === 0) return { inside: [stroke], outside: [] }

  const toStrokes = (frags: NotePoint[][]) => frags
    .filter(f => pathLength(f) >= MIN_FRAGMENT)
    .map(f => ({ ...stroke, id: newStrokeId(), points: f }))
  return { inside: toStrokes(inside), outside: toStrokes(outside) }
}
