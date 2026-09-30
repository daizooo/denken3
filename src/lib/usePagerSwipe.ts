import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

// 横に連結したページ（ストリップ）を、指のドラッグで送るための処理。
//
// ブラウザ標準の横スクロール＋スナップ任せだと、端末によっては2ページ目以降で
// フリックが効かなくなる（入れ子の縦スクロールとの取り合い）。そこで横の動きだけを
// 自前で扱う: ストリップは overflow-x:hidden・touch-action:pan-y にして、
// 縦スクロールはブラウザに任せ、横方向のドラッグはここで scrollLeft に反映する。
// 離したときは隣のページへ滑らかに合わせる（ページ番号は呼び出し側が scroll から読む）。

// 縦より横へ大きく動いたときだけ「横スワイプ」とみなす（縦スクロールとの仕分け）。
const START_PX = 8
const SETTLE_RATIO = 0.2 // 幅の何割を超えて動かしたら隣へ進むか
const FLICK_PX_PER_MS = 0.4 // この速さなら短い距離でも進む

interface Drag {
  id: number
  x0: number
  y0: number
  lastX: number
  t0: number
  base: number // ドラッグ開始時の scrollLeft
  page: number // ドラッグ開始時のページ
  swiping: boolean
}

export function usePagerSwipe(stripRef: RefObject<HTMLDivElement | null>, pageCount: number) {
  const drag = useRef<Drag | null>(null)

  const settle = (d: Drag, x: number) => {
    const el = stripRef.current
    if (!el) return
    const w = el.clientWidth
    const dx = x - d.x0
    const v = dx / Math.max(1, Date.now() - d.t0)
    let next = d.page
    if (dx < -w * SETTLE_RATIO || v < -FLICK_PX_PER_MS) next = d.page + 1
    else if (dx > w * SETTLE_RATIO || v > FLICK_PX_PER_MS) next = d.page - 1
    next = Math.max(0, Math.min(pageCount - 1, next))
    el.scrollTo({ left: next * w, behavior: 'smooth' })
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = stripRef.current
    if (!el || pageCount < 2 || !e.isPrimary) return
    drag.current = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, lastX: e.clientX, t0: Date.now(),
      base: el.scrollLeft, page: Math.round(el.scrollLeft / Math.max(1, el.clientWidth)),
      swiping: false,
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = stripRef.current
    const d = drag.current
    if (!el || !d || d.id !== e.pointerId) return
    if (!d.swiping) {
      const ax = Math.abs(e.clientX - d.x0)
      const ay = Math.abs(e.clientY - d.y0)
      if (ax < START_PX && ay < START_PX) return
      // 縦へ動き出したらブラウザの縦スクロールに任せる（この操作では横送りしない）。
      if (ay >= ax) { drag.current = null; return }
      d.swiping = true
      d.lastX = d.x0
      try { el.setPointerCapture(e.pointerId) } catch { /* 取れなくても動く */ }
    }
    const w = el.clientWidth
    const ddx = e.clientX - d.lastX
    d.lastX = e.clientX
    // 拡大中は、まずそのページの画像を横に動かし、端まで行ってからページを送る。
    const inner = el.children[d.page] as HTMLElement | undefined
    const atPageOrigin = Math.abs(el.scrollLeft - d.page * w) < 1
    const innerMax = inner ? inner.scrollWidth - inner.clientWidth : 0
    const innerCanMove = inner != null && atPageOrigin && innerMax > 1
      && (ddx > 0 ? inner.scrollLeft > 0 : inner.scrollLeft < innerMax - 1)
    if (innerCanMove) {
      inner.scrollLeft -= ddx
      return
    }
    const lo = Math.max(0, d.page - 1) * w
    const hi = Math.min(pageCount - 1, d.page + 1) * w
    el.scrollLeft = Math.max(lo, Math.min(hi, el.scrollLeft - ddx))
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (d.swiping) settle(d, e.clientX)
  }

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (d.swiping) settle(d, d.lastX)
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
