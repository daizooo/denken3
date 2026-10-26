// 「目標日の逆算」の入口（licensehub-expansion.md §10.1・§15の9）。
// 設定画面への組み込みをこの1要素だけにする。社労士でだけ出す。
import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import type { ExamPlan } from '../../domain/types'
import PlanTargets from './PlanTargets'

export default function PlanTargetsButton({
  userId, examId, onSaved,
}: {
  userId: string
  examId: string
  onSaved: (plan: ExamPlan) => void
}) {
  const [open, setOpen] = useState(false)
  if (examId !== 'sharoushi') return null
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border bg-white text-sm text-gray-700"
      >
        <CalendarDays size={16} /> 目標日の逆算（本試験日・重み・学習順・上書き）
      </button>
      {open && <PlanTargets userId={userId} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  )
}
