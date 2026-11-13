// 解答の下書き（ブラウザの localStorage）。精算表のように解くのに時間がかかる設問を、閉じても失わないための保存。
// 採点して記録するまでサーバーには送らない。記録したら消す。
import { useCallback, useEffect, useRef, useState } from 'react'
import type { JournalInput } from '../../lib/kenkei2/types'

export interface Draft {
  answers: Record<string, string>
  journal: JournalInput
  memo: string
}

export const emptyDraft = (): Draft => ({
  answers: {},
  journal: { debit: [{ symbol: '', amount: '' }, { symbol: '', amount: '' }], credit: [{ symbol: '', amount: '' }, { symbol: '', amount: '' }] },
  memo: '',
})

const keyOf = (userId: string, itemId: string) => `kk2:draft:${userId}:${itemId}`

function load(userId: string, itemId: string): Draft {
  try {
    const raw = localStorage.getItem(keyOf(userId, itemId))
    if (!raw) return emptyDraft()
    const d = JSON.parse(raw) as Partial<Draft>
    const base = emptyDraft()
    return {
      answers: d.answers && typeof d.answers === 'object' ? d.answers : base.answers,
      journal: d.journal?.debit && d.journal?.credit ? d.journal : base.journal,
      memo: typeof d.memo === 'string' ? d.memo : '',
    }
  } catch {
    return emptyDraft()
  }
}

export function useDraft(userId: string, itemId: string) {
  const [draft, setDraft] = useState<Draft>(() => load(userId, itemId))
  const cleared = useRef(false)

  useEffect(() => {
    if (cleared.current) return
    try { localStorage.setItem(keyOf(userId, itemId), JSON.stringify(draft)) } catch { /* 容量超過などは下書きを諦める */ }
  }, [draft, userId, itemId])

  const clear = useCallback(() => {
    cleared.current = true
    try { localStorage.removeItem(keyOf(userId, itemId)) } catch { /* 何もしない */ }
  }, [userId, itemId])

  const resume = useCallback(() => { cleared.current = false }, [])
  return { draft, setDraft, clear, resume }
}
