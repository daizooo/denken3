// 2級建設経理の「本番形式模試」の入口（docs/design/kenkei2.md §7 K6）。
// App 側の組み込みをこの1要素だけにする。2級建設経理（exam.id==='kenkei2'）でだけ置く。
import { useState } from 'react'
import { Timer } from 'lucide-react'
import type { Status } from '../../domain/types'
import type { Attempt } from '../../lib/attempt'
import Kenkei2MockView from './Kenkei2MockView'

export default function Kenkei2MockButton({ userId, onRecord }: {
  userId: string
  /** 模試で誤答・未解答だった問を復習キューに入れる（App の updateStatus）。 */
  onRecord?: (itemId: string, status: Status, attempt: Attempt) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border bg-white text-sm text-gray-700"
      >
        <Timer size={16} /> 本番形式模試（120分）
      </button>
      {open && <Kenkei2MockView userId={userId} onRecord={onRecord} onClose={() => setOpen(false)} />}
    </>
  )
}
