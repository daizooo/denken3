// 資格の切り替え口（ヘッダー1か所）。並行学習はしない前提で、選んだ資格だけを稼働・もう一方は休止として扱う。
// 1級土木は資格レジストリ EXAMS に載せない（社労士の画面・集計に混ぜない）ため、選択肢に加えるだけで中身は App 側が出し分ける。
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export const DOBOKU1_SWITCH_ID = 'doboku1'
const STORAGE_KEY = 'licensehub.activeExam'

export function readStoredExam(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}
export function storeExam(id: string): void {
  try { localStorage.setItem(STORAGE_KEY, id) } catch { /* 記憶できなくても動作に支障なし */ }
}

export interface ExamOption { id: string; name: string }

export default function ExamSwitcher({ value, options, onChange }: {
  value: string
  options: ExamOption[]
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const current = options.find(o => o.id === value) ?? options[0]
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="資格の切り替え"
        className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-sm font-bold text-gray-800 hover:bg-gray-50"
      >
        {current.name}
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-8 z-50 w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
          {options.map(o => {
            const active = o.id === current.id
            return (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { setOpen(false); if (!active) onChange(o.id) }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                {o.name}
                <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {active ? '稼働中' : '休止中'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
