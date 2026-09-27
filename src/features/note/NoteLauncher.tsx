import { useCallback, useEffect, useState } from 'react'
import { NotebookPen } from 'lucide-react'
import { watchTwoFingerTap } from '../../lib/note/twoFingerTap'
import NoteOverlay from './NoteOverlay'

// 問題画面に置くノートの入口。ボタンと白紙の本体を1つにまとめ、
// 各ビューア（分野別・年度別CBT）からは1行で差し込めるようにしている
// （問題表示側のファイルを薄く保つ＝同時編集のぶつかりを減らす）。
//
// 解いている間はノートと問題を何度も行き来するので、切り替えは2通り用意する:
//   ・2本指でタップ（ノート側・問題側のどちらでも効く。ペンでは暴発しない）
//   ・このボタン／ノートの「問題」ボタン
// 切り替えでは本体を外さずに隠すだけなので、書いた式も取り消し履歴も残る。
// 問題そのものを閉じるとこの入口ごと消え、ノートは白紙に戻る。
export default function NoteLauncher({
  noteId, title, className,
}: {
  /** どの問題のノートか。 */
  noteId: string
  title?: string
  className?: string
}) {
  // opened: ノート本体を作ったか（＝この問題で一度でも開いたか）
  // hidden: 問題を見るために引っ込めているか
  const [opened, setOpened] = useState(false)
  const [hidden, setHidden] = useState(false)

  const show = useCallback(() => { setOpened(true); setHidden(false) }, [])
  const hide = useCallback(() => setHidden(true), [])
  const toggle = () => (opened && !hidden ? hide() : show())

  // 問題を見ている間の2本指タップでノートへ戻る（ノート側と同じ操作で往復できる）。
  useEffect(() => {
    if (!opened || !hidden) return
    return watchTwoFingerTap(window, show)
  }, [opened, hidden, show])

  const showing = opened && !hidden
  return (
    <>
      <button
        onClick={toggle}
        title={showing ? '問題へ戻る（2本指タップでも切り替わります）' : 'ノート（計算用の白紙・2本指タップでも開きます）'}
        className={className ?? `relative p-1.5 rounded-lg ${
          showing ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-100'
        }`}
      >
        <NotebookPen size={18} />
      </button>
      {opened && (
        <NoteOverlay noteId={noteId} title={title} hidden={hidden} onHide={hide} />
      )}
    </>
  )
}
