import { useEffect, useState } from 'react'
import { NotebookPen } from 'lucide-react'
import { hasNote } from '../../lib/note/noteStore'
import NoteOverlay from './NoteOverlay'

// 問題画面に置くノートの入口。ボタンと白紙の本体を1つにまとめ、
// 各ビューア（分野別・年度別CBT）からは1行で差し込めるようにしている
// （問題表示側のファイルを薄く保つ＝同時編集のぶつかりを減らす）。
export default function NoteLauncher({
  noteId, title, className,
}: {
  /** ノートの保存単位。問題IDを渡す。 */
  noteId: string
  title?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // 「この問題には前回の式が残っている」を印で示す。開閉と問題の切り替えで見直す。
  const [written, setWritten] = useState(() => hasNote(noteId))
  useEffect(() => { setWritten(hasNote(noteId)) }, [noteId, open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="ノート（計算用の白紙）"
        className={className ?? 'relative p-1.5 rounded-lg text-gray-500 hover:bg-gray-100'}
      >
        <NotebookPen size={18} />
        {written && (
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
        )}
      </button>
      {open && <NoteOverlay noteId={noteId} title={title} onClose={() => setOpen(false)} />}
    </>
  )
}
