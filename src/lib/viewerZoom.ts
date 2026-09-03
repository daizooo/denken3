// 問題画像ビューアの表示倍率（課題16）。
//
// 表示の基準は「端末の画面幅に自動で合わせた大きさ（＝100%）」で、各ビューアが
// 見せたい範囲（分野別なら見開きの左ページ、年度別なら1問1枚の縦切り出し）を
// 画面幅いっぱいに描くところまでを担当する。ここで扱うのはその基準からの微調整で、
// 「開くたびに＋を押す」を無くすために端末ごと（localStorage）に記憶する。
//
// スコープ（'bunya' / 'cbt'）別に持つ。見開きと縦長ページでは好みの倍率が別だから。
import { useCallback, useState } from 'react'

export const ZOOM_STEPS: number[] = [0.75, 1, 1.25, 1.5, 2, 2.5, 3]
export const DEFAULT_ZOOM = 1

const KEY_PREFIX = 'denken3:viewer-zoom:'

// localStorage は Safari のプライベートモード等で例外を投げうるので、
// 読み書きとも失敗は既定値へ静かに落とす（表示は続行する）。
export function loadZoom(scope: string): number {
  try {
    const v = Number(localStorage.getItem(KEY_PREFIX + scope))
    return ZOOM_STEPS.includes(v) ? v : DEFAULT_ZOOM
  } catch {
    return DEFAULT_ZOOM
  }
}

export function saveZoom(scope: string, zoom: number): void {
  try { localStorage.setItem(KEY_PREFIX + scope, String(zoom)) } catch { /* 記憶できなくても表示は続く */ }
}

/** 記憶された倍率と、1段ずつの拡大・縮小。 */
export function useViewerZoom(scope: string) {
  const [zoom, setZoom] = useState(() => loadZoom(scope))
  const step = useCallback((dir: 1 | -1) => {
    setZoom(prev => {
      const cur = ZOOM_STEPS.indexOf(prev)
      const from = cur < 0 ? ZOOM_STEPS.indexOf(DEFAULT_ZOOM) : cur
      const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, from + dir))]
      saveZoom(scope, next)
      return next
    })
  }, [scope])
  const zoomIn = useCallback(() => step(1), [step])
  const zoomOut = useCallback(() => step(-1), [step])
  return {
    zoom,
    zoomIn,
    zoomOut,
    canZoomIn: zoom < ZOOM_STEPS[ZOOM_STEPS.length - 1],
    canZoomOut: zoom > ZOOM_STEPS[0],
    label: `${Math.round(zoom * 100)}%`,
  }
}
