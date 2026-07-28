import { createContext, useContext } from 'react'

// ==============================
// ステルス（擬装）モードの共有状態
// enabled: 擬装モード（会社モード）のON/OFF。
// hidden : パニックカバー（ダミー文書）を全面表示中か。
// ==============================
export interface StealthState {
  enabled: boolean
  hidden: boolean
  setEnabled: (v: boolean) => void
  toggle: () => void
  hide: () => void
  reveal: () => void
}

export const StealthContext = createContext<StealthState | null>(null)

// Provider の外で呼ばれた場合は擬装OFF相当の安全なデフォルトを返す（呼び出し側を守る）。
export function useStealth(): StealthState {
  return (
    useContext(StealthContext) ?? {
      enabled: false,
      hidden: false,
      setEnabled: () => {},
      toggle: () => {},
      hide: () => {},
      reveal: () => {},
    }
  )
}
