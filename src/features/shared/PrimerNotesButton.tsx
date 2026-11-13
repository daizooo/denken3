// 「入門ノート」の入口。2級建設経理・1級土木の「入門」科目を開いているときだけ App が置く。
import { useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import PrimerNotesView from './PrimerNotesView'
import { primerNotesTopics } from './primerNotesTopics'

export default function PrimerNotesButton({ examId, onOpen }: {
  examId: string
  onOpen: (itemId: string, title: string) => void
}) {
  const [open, setOpen] = useState(false)
  const topics = useMemo(() => primerNotesTopics(examId), [examId])
  if (topics.length === 0) return null
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1 rounded-xl border border-amber-300 bg-amber-50 py-2 text-sm font-bold text-amber-900">
        <BookOpen size={16} /> 入門ノート（図解つき・章ごとに問題）
      </button>
      {open && <PrimerNotesView heading="入門" topics={topics} onOpen={onOpen} onClose={() => setOpen(false)} />}
    </>
  )
}
