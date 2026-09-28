// 2本指タップの検出。ノートと問題を瞬時に行き来するための合図に使う。
//
// 2本指を選んだ理由:
//   ・ペンで書いている最中に暴発しない（ペンは1点しか触れない）。
//   ・パームリジェクト中でも使える（描画には渡さない指の入力を、切り替えにだけ使う）。
//   ・1本指のダブルタップだと、点を2回打つ操作と区別できない。
//
// 「2本指で軽く叩く」だけを拾う: 指が動いたら（＝スクロール・ピンチ）取り消し、
// 長く押さえても取り消す。

const MAX_MS = 400
// 指がこれ以上動いたらタップではない（画面幅に対する比ではなく px。指の震えを吸収する程度）。
const MAX_MOVE_PX = 24

export function watchTwoFingerTap(target: EventTarget, onTap: () => void): () => void {
  let startedAt = 0
  let origin: { x: number; y: number }[] = []
  let alive = false

  const cancel = () => { alive = false; origin = [] }

  const onStart = (ev: Event) => {
    const e = ev as TouchEvent
    if (e.touches.length !== 2) { cancel(); return }
    alive = true
    startedAt = Date.now()
    origin = [0, 1].map(i => ({ x: e.touches[i].clientX, y: e.touches[i].clientY }))
  }

  const onMove = (ev: Event) => {
    if (!alive) return
    const e = ev as TouchEvent
    for (let i = 0; i < e.touches.length && i < origin.length; i++) {
      const dx = e.touches[i].clientX - origin[i].x
      const dy = e.touches[i].clientY - origin[i].y
      if (Math.hypot(dx, dy) > MAX_MOVE_PX) { cancel(); return }
    }
  }

  const onEnd = (ev: Event) => {
    if (!alive) return
    const e = ev as TouchEvent
    // 2本とも離れた時点で判定する（1本ずつ離れる端末があるため残りが0になるまで待つ）。
    if (e.touches.length > 0) return
    const quick = Date.now() - startedAt <= MAX_MS
    cancel()
    if (quick) onTap()
  }

  target.addEventListener('touchstart', onStart, { passive: true })
  target.addEventListener('touchmove', onMove, { passive: true })
  target.addEventListener('touchend', onEnd, { passive: true })
  target.addEventListener('touchcancel', cancel, { passive: true })
  return () => {
    target.removeEventListener('touchstart', onStart)
    target.removeEventListener('touchmove', onMove)
    target.removeEventListener('touchend', onEnd)
    target.removeEventListener('touchcancel', cancel)
  }
}
