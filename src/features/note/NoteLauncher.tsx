import { useCallback, useEffect, useState } from 'react'
import { BookOpen, NotebookPen } from 'lucide-react'
import { watchTwoFingerTap } from '../../lib/note/twoFingerTap'
import NoteOverlay from './NoteOverlay'

// 問題画面に置くノートの入口。ボタンと白紙の本体を1つにまとめ、
// 各ビューア（分野別・年度別CBT）からは1行で差し込めるようにしている
// （問題表示側のファイルを薄く保つ＝同時編集のぶつかりを減らす）。
//
// 解いている間はノートと問題を何度も行き来するので、切り替え口は2つ:
//   ・2本指タップ（問題側・ノート側のどちらでも。最初の問題画面から効く）
//   ・画面端のつまみ（ペンで狙える大きさ。スタイラス運用の主役）
// ツールバーには切り替えボタンを置かない。つまみが常に同じ高さに出ているので、
// 上部まで手を伸ばす操作を1つ減らせる。
// 切り替えは本体を外さずに隠すだけなので、書いた式も取り消し履歴も残る。
// 問題そのものを閉じるとこの入口ごと消え、ノートは白紙に戻る。
export default function NoteLauncher({
  noteId, title,
}: {
  /** どの問題のノートか。 */
  noteId: string
  title?: string
}) {
  // opened: ノート本体を作ったか（＝この問題で一度でも開いたか）
  // hidden: 問題を見るために引っ込めているか
  const [opened, setOpened] = useState(false)
  const [hidden, setHidden] = useState(false)
  const showing = opened && !hidden

  const show = useCallback(() => { setOpened(true); setHidden(false) }, [])
  const hide = useCallback(() => setHidden(true), [])
  const toggle = useCallback(() => (showing ? hide() : show()), [showing, hide, show])

  // 問題を見ている間の2本指タップでノートを開く。
  // まだ一度も開いていない状態でも効かせる（最初の問題画面から同じ操作で入れる）。
  useEffect(() => {
    if (showing) return
    return watchTwoFingerTap(window, show)
  }, [showing, show])

  return (
    <>
      {/* 画面端のつまみ。ペンを持ったまま1タップで往復できる（指に持ち替えなくてよい）。
          問題側は右端、ノート側は左端に出す――ノートでは右手と紙が画面の右側を
          占めるため、書く手の下につまみが隠れないようにする。
          ノートの上に重ねるため、オーバーレイ（z-60）より前に置く。
          文字は入れず絵記号だけにしている（縦書きの文字は端末のフォント次第で
          潰れることがあり、幅を取ると書く面積も削る）。 */}
      <button
        onClick={toggle}
        title={showing ? '問題へ戻る' : 'ノートを開く'}
        aria-label={showing ? '問題へ戻る' : 'ノートを開く'}
        className={`fixed top-1/2 -translate-y-1/2 z-[68] flex items-center justify-center
          border bg-blue-600/90 border-blue-700 text-white shadow-lg
          px-2 py-4 hover:bg-blue-600 touch-none ${
            showing ? 'left-0 rounded-r-xl border-l-0' : 'right-0 rounded-l-xl border-r-0'
          }`}
      >
        {showing ? <BookOpen size={18} /> : <NotebookPen size={18} />}
      </button>

      {opened && (
        <NoteOverlay noteId={noteId} title={title} hidden={hidden} onHide={hide} />
      )}
    </>
  )
}
