import { useCallback, useEffect, useState } from 'react'
import { StealthContext } from './context'
import PanicOverlay from './PanicOverlay'
import {
  STEALTH_STORAGE_KEY, STEALTH_URL_PARAM, CORNER_THRESHOLD_PX,
  PANIC_CORNER, DISGUISE_TITLE, DISGUISE_FAVICON,
} from './config'

// 起動時の擬装モード判定: URL に ?work=1 があれば最優先で擬装ON、
// 無ければ localStorage の記憶を使う。会社PCでは ?work=1 のURLをブックマークすればよい。
function readInitialEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get(STEALTH_URL_PARAM) === '1') return true
    return localStorage.getItem(STEALTH_STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

// カーソルが指定の画面隅（既定=左上）に触れたか。
function isAtPanicCorner(e: MouseEvent): boolean {
  const atX = PANIC_CORNER.x === 'left'
    ? e.clientX <= CORNER_THRESHOLD_PX
    : e.clientX >= window.innerWidth - CORNER_THRESHOLD_PX
  const atY = PANIC_CORNER.y === 'top'
    ? e.clientY <= CORNER_THRESHOLD_PX
    : e.clientY >= window.innerHeight - CORNER_THRESHOLD_PX
  return atX && atY
}

// ==============================
// ステルス（擬装）モードの Provider
// - enabled: 擬装モード。ONの間、UI全体を地味な業務ソフト風に寄せ、タブ名/アイコンも擬装。
// - hidden : パニックカバー（ダミー文書）を全面表示。マウスを隅へ／ウィンドウ非アクティブで自動発動。
// 学習ロジックには一切干渉せず、App を「被せる」だけの構成。
// ==============================
export default function StealthProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(readInitialEnabled)
  // 擬装ONで起動したら、まず隠した状態から始める（開いた瞬間に中身を晒さない）。
  const [hidden, setHidden] = useState(readInitialEnabled)

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v)
    setHidden(v) // ONにした直後はカバーを出し、OFFなら必ず解除する
    try { localStorage.setItem(STEALTH_STORAGE_KEY, v ? 'on' : 'off') } catch { /* 記憶できなくても動作は継続 */ }
  }, [])
  const toggle = useCallback(() => setEnabled(!enabled), [enabled, setEnabled])
  const hide = useCallback(() => setHidden(true), [])
  const reveal = useCallback(() => setHidden(false), [])

  // ?work=1 で来たら localStorage にも記憶しておく（次回はパラメータ無しでも擬装で起動）。
  useEffect(() => {
    if (!enabled) return
    try { localStorage.setItem(STEALTH_STORAGE_KEY, 'on') } catch { /* noop */ }
  }, [enabled])

  // ---- パニックカバーの自動発動（擬装ON時のみ） ----
  useEffect(() => {
    if (!enabled) return
    const onMove = (e: MouseEvent) => { if (isAtPanicCorner(e)) setHidden(true) }
    const onHideEvent = () => setHidden(true)
    const onVisibility = () => { if (document.hidden) setHidden(true) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('blur', onHideEvent)        // 他ウィンドウ/アプリへ切替
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('blur', onHideEvent)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled])

  // ---- タブ名・ファビコンの擬装（擬装ON時のみ。OFFで元に戻す） ----
  useEffect(() => {
    if (!enabled) return
    const prevTitle = document.title
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    const created = !link
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    const prevHref = link.getAttribute('href')
    const prevType = link.getAttribute('type')

    document.title = DISGUISE_TITLE
    link.setAttribute('type', 'image/svg+xml')
    link.setAttribute('href', DISGUISE_FAVICON)
    document.documentElement.dataset.stealth = 'on'

    return () => {
      document.title = prevTitle
      if (created) {
        link!.remove()
      } else {
        if (prevHref !== null) link!.setAttribute('href', prevHref); else link!.removeAttribute('href')
        if (prevType !== null) link!.setAttribute('type', prevType); else link!.removeAttribute('type')
      }
      delete document.documentElement.dataset.stealth
    }
  }, [enabled])

  // ---- 擬装モードの全体トグル（覚えやすい隠しショートカット: Ctrl+Alt+H） ----
  // 会社PC以外（自宅など）で擬装を解いて通常表示に戻すためのスイッチ。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return (
    <StealthContext.Provider value={{ enabled, hidden, setEnabled, toggle, hide, reveal }}>
      {/* 擬装ON時は彩度を落として「地味な業務ツール」に寄せる（skin は index.css） */}
      <div className={enabled ? 'stealth-skin' : undefined}>{children}</div>
      {enabled && hidden && <PanicOverlay onReveal={reveal} />}
    </StealthContext.Provider>
  )
}
