// 復習タブの「一括コピー」「一括記録」ボタンと、その画面の切り替え（licensehub-expansion.md §6.3）。
// App 側の組み込みをこの1要素だけにするための入口。allText の資格（社労士）でだけ置く。
import { useMemo, useState } from 'react'
import { ClipboardCopy, ListChecks } from 'lucide-react'
import type { ReviewHistoryEntry, Status } from '../../domain/types'
import type { Attempt } from '../../lib/attempt'
import BatchCopy from './BatchCopy'
import BatchGrade from './BatchGrade'

export default function BatchButtons({
  userId, examId, queueIds, questions, historyOf, onRecord, onDeleteEntry,
}: {
  userId: string
  examId: string
  /** 今日の復習キュー（表示順）。 */
  queueIds: string[]
  /** 行の見出し用（折りたたみの中に出す）。 */
  questions: { id: string; number: number; title: string; chapterName: string }[]
  historyOf: (id: string) => ReviewHistoryEntry[]
  onRecord: (id: string, status: Status, attempt: Attempt) => string
  onDeleteEntry: (id: string, index: number) => void
}) {
  const [open, setOpen] = useState<'copy' | 'grade' | null>(null)
  const titles = useMemo(
    () => new Map(questions.map(q => [q.id, `${q.chapterName} 問${q.number}　${q.title}`])),
    [questions],
  )

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setOpen('copy')}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border bg-white text-sm text-gray-700"
        >
          <ClipboardCopy size={16} /> 一括コピー
        </button>
        <button
          onClick={() => setOpen('grade')}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border bg-white text-sm text-gray-700"
        >
          <ListChecks size={16} /> 一括記録
        </button>
      </div>
      {open === 'copy' && (
        <BatchCopy
          userId={userId}
          examId={examId}
          queueIds={queueIds}
          onClose={() => setOpen(null)}
          onGoGrade={() => setOpen('grade')}
        />
      )}
      {open === 'grade' && (
        <BatchGrade
          userId={userId}
          examId={examId}
          titleOf={id => titles.get(id) ?? ''}
          historyOf={historyOf}
          onRecord={onRecord}
          onDeleteEntry={onDeleteEntry}
          onClose={() => setOpen(null)}
          onGoCopy={() => setOpen('copy')}
        />
      )}
    </>
  )
}
