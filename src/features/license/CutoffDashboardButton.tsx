// 「足切りダッシュボード」の入口（licensehub-expansion.md §10.2・PR-I）。
// App 側の組み込みをこの1要素だけにする。allText の資格（社労士）でだけ置く。
import { useState } from 'react'
import { Gauge } from 'lucide-react'
import type { ExamDefinition, Review } from '../../domain/types'
import CutoffDashboard from './CutoffDashboard'

export default function CutoffDashboardButton({ userId, exam, reviews }: {
  userId: string
  exam: ExamDefinition
  reviews: Record<string, Review>
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border bg-white text-sm text-gray-700"
      >
        <Gauge size={16} /> 足切り・5月末ゲート
      </button>
      {open && <CutoffDashboard userId={userId} exam={exam} reviews={reviews} onClose={() => setOpen(false)} />}
    </>
  )
}
