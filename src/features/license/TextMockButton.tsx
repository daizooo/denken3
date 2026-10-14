// 「本番形式模試」の入口（licensehub-expansion.md §7・PR-H）。
// App 側の組み込みをこの1要素だけにする。allText の資格（社労士）でだけ置く。
import { useState } from 'react'
import { Timer } from 'lucide-react'
import TextMockView from './TextMockView'

export default function TextMockButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border bg-white text-sm text-gray-700"
      >
        <Timer size={16} /> 本番形式模試
      </button>
      {open && <TextMockView userId={userId} onClose={() => setOpen(false)} />}
    </>
  )
}
