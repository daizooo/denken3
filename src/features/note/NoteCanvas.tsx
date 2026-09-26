import { useCallback, useEffect, useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import {
  hitStroke, newStrokeId, simplifyPoints, strokeBBox, strokesInLasso,
  type NoteDoc, type NotePoint, type NoteStroke, type NoteTool,
} from '../../lib/note/noteModel'

// ノートの描画面。入力（ポインタ）と描画（canvas）だけを担い、
// 線の集まり（NoteDoc）の持ち主は親（NoteOverlay）に置く。
// 取り消し／やり直しを親の履歴だけで完結させるため、
// 「手を下ろした時点」で親に onGestureStart を伝え、以降の変更は履歴を積まない。

// 消しゴムの当たり半径（論理単位＝幅1基準）。指でも狙えて、隣の式は消えない大きさ。
const ERASER_R = 0.022
// 手書きの点を拾う間隔。これ未満の移動は捨てる（点が増えすぎると保存も再描画も重くなる）。
const MIN_STEP = 0.002
// 書き終わりの間引き量。見た目が変わらない範囲に留める。
const SIMPLIFY_TOL = 0.0015

/** 筆圧を太さの倍率へ。スタイラス以外（筆圧なし）は一定の太さで描く。 */
function widthAt(base: number, p: number | undefined): number {
  return p == null ? base : base * (0.45 + 0.55 * Math.min(1, Math.max(0, p)))
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: NoteStroke, scale: number) {
  const pts = stroke.points
  ctx.strokeStyle = stroke.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (pts.length === 1) {
    // 置いただけの点も見えるようにする（小数点・添字はこれで書く）。
    ctx.fillStyle = stroke.color
    ctx.beginPath()
    ctx.arc(pts[0].x * scale, pts[0].y * scale, (widthAt(stroke.width, pts[0].p) * scale) / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const hasPressure = pts.some(pt => pt.p != null)
  if (!hasPressure) {
    ctx.lineWidth = stroke.width * scale
    ctx.beginPath()
    ctx.moveTo(pts[0].x * scale, pts[0].y * scale)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * scale, pts[i].y * scale)
    ctx.stroke()
    return
  }
  // 筆圧つきは線分ごとに太さを変える（1本のパスでは太さを途中で変えられない）。
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    ctx.lineWidth = ((widthAt(stroke.width, a.p) + widthAt(stroke.width, b.p)) / 2) * scale
    ctx.beginPath()
    ctx.moveTo(a.x * scale, a.y * scale)
    ctx.lineTo(b.x * scale, b.y * scale)
    ctx.stroke()
  }
}

export default function NoteCanvas({
  doc, tool, color, width, penOnly,
  onGestureStart, onAddStroke, onRemoveStrokes, onMoveStrokes, onPenDetected,
}: {
  doc: NoteDoc
  tool: NoteTool
  color: string
  /** 論理単位の太さ（描画領域の幅に対する比）。 */
  width: number
  /** スタイラス以外（指・手のひら）の入力を無視するか。 */
  penOnly: boolean
  /** これから線が増える・消える・動く、を親へ伝える（親はここで履歴を1つ積む）。 */
  onGestureStart: () => void
  onAddStroke: (stroke: NoteStroke) => void
  onRemoveStrokes: (ids: string[]) => void
  onMoveStrokes: (ids: string[], dx: number, dy: number) => void
  /** スタイラスの入力を初めて見たとき（親が手のひら無視の既定を決める）。 */
  onPenDetected: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // 表示サイズ（CSS px）。canvas の実ピクセルは devicePixelRatio 倍で持つ。
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [selected, setSelected] = useState<string[]>([])

  // 進行中のジェスチャ。1フレームに何度も来るため state ではなく ref に置き、
  // 再描画は requestAnimationFrame にまとめる。
  const gesture = useRef<{
    pointerId: number
    kind: 'draw' | 'line' | 'erase' | 'lasso' | 'move'
    points: NotePoint[]
    /** 移動ツールの掴み始め（論理座標）と、今の移動量。 */
    from: { x: number; y: number }
    delta: { x: number; y: number }
    moving: string[]
  } | null>(null)
  const drawRef = useRef<() => void>(() => {})
  const rafRef = useRef(0)

  const schedule = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      drawRef.current()
    })
  }, [])

  // 表示サイズの追従。回転・分割画面でも比率どおりに描き直す。
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 全部描き直す。線の本数はせいぜい数百本で、rAF に間引けば実用上これで足りる
  // （差分描画にすると、消しゴム・移動・取り消しのたびに整合を取る必要が出る）。
  drawRef.current = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size.w === 0) return
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
    const pw = Math.round(size.w * dpr)
    const ph = Math.round(size.h * dpr)
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size.w, size.h)
    // 論理単位（幅=1）から CSS px への倍率。
    const scale = size.w
    const g = gesture.current
    const moving = g?.kind === 'move' ? new Set(g.moving) : null

    for (const s of doc.strokes) {
      if (moving?.has(s.id)) {
        // 掴んでいる線は移動量ぶんずらして描く（確定は指を離したとき）。
        const dx = g?.delta.x ?? 0
        const dy = g?.delta.y ?? 0
        drawStroke(ctx, { ...s, points: s.points.map(pt => ({ ...pt, x: pt.x + dx, y: pt.y + dy })) }, scale)
      } else {
        drawStroke(ctx, s, scale)
      }
    }

    // 書いている途中の線・直線のプレビュー。
    if (g && (g.kind === 'draw' || g.kind === 'line') && g.points.length > 0) {
      drawStroke(ctx, { id: 'live', color, width, points: g.points }, scale)
    }

    // 投げ縄の軌跡。
    if (g?.kind === 'lasso' && g.points.length > 1) {
      ctx.save()
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(g.points[0].x * scale, g.points[0].y * scale)
      for (let i = 1; i < g.points.length; i++) ctx.lineTo(g.points[i].x * scale, g.points[i].y * scale)
      ctx.closePath()
      ctx.stroke()
      ctx.restore()
    }

    // 選択中の囲み。移動量ぶん一緒にずらす。
    if (selected.length > 0) {
      const dx = moving ? (g?.delta.x ?? 0) : 0
      const dy = moving ? (g?.delta.y ?? 0) : 0
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const s of doc.strokes) {
        if (!selected.includes(s.id)) continue
        const b = strokeBBox(s)
        x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0)
        x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1)
      }
      if (x0 < Infinity) {
        ctx.save()
        ctx.strokeStyle = '#2563eb'
        ctx.fillStyle = 'rgba(37,99,235,0.08)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([5, 3])
        const px = (x0 + dx) * scale, py = (y0 + dy) * scale
        const pw2 = (x1 - x0) * scale, ph2 = (y1 - y0) * scale
        ctx.fillRect(px, py, pw2, ph2)
        ctx.strokeRect(px, py, pw2, ph2)
        ctx.restore()
      }
    }
  }

  useEffect(() => { schedule() }, [doc, size, selected, color, width, schedule])
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  // 画面座標 → 論理座標（縦横とも「幅」で割る）。
  const toLogical = (e: React.PointerEvent): NotePoint => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const w = rect.width || 1
    return {
      x: (e.clientX - rect.left) / w,
      y: (e.clientY - rect.top) / w,
      p: e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : undefined,
    }
  }

  const eraseAt = (pt: NotePoint) => {
    const ids = doc.strokes.filter(s => hitStroke(s, pt.x, pt.y, ERASER_R)).map(s => s.id)
    if (ids.length > 0) onRemoveStrokes(ids)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen') onPenDetected()
    // スタイラス運用中は指・手のひらを無視する（ノートに手を置いて書ける）。
    if (penOnly && e.pointerType !== 'pen') return
    // 2本目以降の指は無視する（1本目の線が飛ぶのを防ぐ）。
    if (gesture.current) return
    const pt = toLogical(e)
    e.currentTarget.setPointerCapture(e.pointerId)

    // 選択済みの中を掴んだら移動、外を触ったら選択し直し。
    if (tool === 'lasso' && selected.length > 0) {
      const inside = doc.strokes.some(s => selected.includes(s.id) && hitStroke(s, pt.x, pt.y, 0.02))
      if (inside) {
        onGestureStart()
        gesture.current = {
          pointerId: e.pointerId, kind: 'move', points: [pt],
          from: { x: pt.x, y: pt.y }, delta: { x: 0, y: 0 }, moving: [...selected],
        }
        schedule()
        return
      }
      setSelected([])
    }

    const kind = tool === 'eraser' ? 'erase' : tool === 'lasso' ? 'lasso' : tool === 'line' ? 'line' : 'draw'
    // 線を消す・増やすジェスチャの直前に履歴を1つ積む（投げ縄の選択だけなら積まない）。
    if (kind !== 'lasso') onGestureStart()
    gesture.current = {
      pointerId: e.pointerId, kind, points: [pt],
      from: { x: pt.x, y: pt.y }, delta: { x: 0, y: 0 }, moving: [],
    }
    if (kind === 'erase') eraseAt(pt)
    schedule()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    // 間引かれた中間点も拾う（速く書いた線が角張らない）。
    const raw = typeof e.nativeEvent.getCoalescedEvents === 'function'
      ? e.nativeEvent.getCoalescedEvents()
      : []
    const events = raw.length > 0 ? raw : [e.nativeEvent]
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const w = rect.width || 1
    const pts: NotePoint[] = events.map(ev => ({
      x: (ev.clientX - rect.left) / w,
      y: (ev.clientY - rect.top) / w,
      p: e.pointerType === 'pen' && ev.pressure > 0 ? ev.pressure : undefined,
    }))

    if (g.kind === 'erase') {
      for (const pt of pts) eraseAt(pt)
      return
    }
    if (g.kind === 'move') {
      const last = pts[pts.length - 1]
      g.delta = { x: last.x - g.from.x, y: last.y - g.from.y }
      schedule()
      return
    }
    if (g.kind === 'line') {
      // 直線は始点と今の指先の2点だけ。
      g.points = [g.points[0], pts[pts.length - 1]]
      schedule()
      return
    }
    for (const pt of pts) {
      const prev = g.points[g.points.length - 1]
      if (Math.hypot(pt.x - prev.x, pt.y - prev.y) < MIN_STEP) continue
      g.points.push(pt)
    }
    schedule()
  }

  const finish = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    gesture.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* 既に外れていれば何もしない */ }

    if (g.kind === 'draw' || g.kind === 'line') {
      const pts = g.kind === 'line' ? g.points : simplifyPoints(g.points, SIMPLIFY_TOL)
      // 直線は2点そろって初めて線になる（点で終わったら何も足さない）。
      if (g.kind === 'line' && pts.length < 2) { schedule(); return }
      onAddStroke({ id: newStrokeId(), color, width, points: pts })
    } else if (g.kind === 'lasso') {
      setSelected(strokesInLasso(doc.strokes, g.points))
    } else if (g.kind === 'move') {
      if (g.delta.x !== 0 || g.delta.y !== 0) onMoveStrokes(g.moving, g.delta.x, g.delta.y)
    }
    schedule()
  }

  // 道具を変えたら選択は解く（選択枠が残ったままペンに戻ると触りどころが分からない）。
  useEffect(() => { setSelected([]) }, [tool])
  // 取り消し等で消えた線は選択から外す。
  useEffect(() => {
    setSelected(prev => {
      const alive = prev.filter(id => doc.strokes.some(s => s.id === id))
      return alive.length === prev.length ? prev : alive
    })
  }, [doc])

  const cutSelected = () => {
    if (selected.length === 0) return
    onGestureStart()
    onRemoveStrokes(selected)
    setSelected([])
  }

  return (
    <div ref={wrapRef} className="relative w-full h-full bg-white">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        // touch-action: none が無いと、書いている途中でブラウザのスクロール・
        // ピンチに取られて線が途切れる。
        className="absolute inset-0 w-full h-full touch-none select-none"
        style={{ cursor: tool === 'eraser' ? 'cell' : tool === 'lasso' ? 'move' : 'crosshair' }}
      />
      {/* 選択中の操作（切り取り）。指でも押せる大きさで、書く手の邪魔にならない上端に置く。 */}
      {selected.length > 0 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-white/95 shadow-lg border border-gray-200 px-2 py-1">
          <span className="text-[11px] text-gray-500 px-1">{selected.length}本を選択中・ドラッグで移動</span>
          <button
            onClick={cutSelected}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-red-600 hover:bg-red-50"
            title="選択した線を切り取る"
          ><Trash2 size={13} /> 切り取り</button>
          <button
            onClick={() => setSelected([])}
            className="p-1 rounded-full text-gray-400 hover:bg-gray-100"
            title="選択を解除"
          ><X size={14} /></button>
        </div>
      )}
    </div>
  )
}
