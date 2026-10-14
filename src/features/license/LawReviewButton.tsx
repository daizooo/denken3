// 「要確認一覧（法改正）」の入口（licensehub-expansion.md §9・PR-K）。
// App 側の組み込みをこの1要素だけにする。allText の資格（社労士）でだけ置く。
import { useState } from 'react'
import { Scale } from 'lucide-react'
import LawReview from './LawReview'

export default function LawReviewButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border bg-white text-sm text-gray-700"
      >
        <Scale size={16} /> 要確認一覧（法改正）
      </button>
      {open && <LawReview userId={userId} onClose={() => setOpen(false)} />}
    </>
  )
}
