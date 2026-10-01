import { useEffect, useState } from 'react'
import { BookOpen, PauseCircle, Undo2 } from 'lucide-react'
import type { Status } from '../../domain/types'
import { formatClock } from '../../lib/solveTimer'
import { STATUS_BG, STATUS_LABEL } from '../shared/status'

// ProblemViewer 下部の理解度バー。
//
// 記録しても画面は閉じない。理解度は「その瞬間の想起結果の確定」であって学習の終わりではなく、
// 「分からない」と思った時点で C を押したあとも、問題と解説を行き来して原理を理解したい
// （押すたびに閉じると、正しいタイミングで押すほど学習が打ち切られる）。
//
// 記録後は A/B/C を隠して「記録済み」に差し替える。学習後に押し直せると、説明を読んだ後の
// 後知恵で A/B に書き換わり、FSRS が「想起できた」と誤認して間隔が伸びてしまうため。
// 誤タップだけは「修正」（直前の記録の取り消し）で選び直せる。
export default function RecordBar({
  recorded, recordedAt, onRecord, onUndo, onAbort,
}: {
  // このセッションで記録した理解度（未記録は null）。
  recorded: Status | null
  // 記録した時刻(ms epoch)。記録後の「学習中」経過の起点。
  recordedAt: number | null
  onRecord: (status: Status) => void
  // 直前の記録を取り消す（誤タップの修正）。
  onUndo: () => void
  // 計測を破棄して閉じる。未記録で計測中のときだけ渡される。
  onAbort?: () => void
}) {
  // 記録後の経過。保存はしない（解答時間に混ぜない）。目安として表示するだけ。
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (recorded == null) return
    setNow(Date.now())
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [recorded])

  if (recorded != null) {
    const studySec = recordedAt != null ? Math.max(0, Math.floor((now - recordedAt) / 1000)) : 0
    return (
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white/95 border-t border-gray-100">
        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_BG[recorded]}`}
          title={STATUS_LABEL[recorded]}>
          {recorded} 記録済み
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <BookOpen size={12} /> 学習中
          <span className="font-mono tabular-nums">{formatClock(studySec)}</span>
        </span>
        <button
          onClick={onUndo}
          title="直前の記録を取り消して選び直します"
          className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          <Undo2 size={12} /> 修正
        </button>
      </div>
    )
  }

  return (
    <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white/95 border-t border-gray-100">
      <span className="text-[11px] text-gray-500 shrink-0">理解度</span>
      {(['A', 'B', 'C'] as Status[]).map(s => (
        <button
          key={s}
          onClick={() => onRecord(s)}
          title={STATUS_LABEL[s]}
          className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >{s}</button>
      ))}
      {onAbort && (
        <button
          onClick={onAbort}
          title="計測を破棄して閉じます（記録は残りません）"
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          <PauseCircle size={13} /> 中断
        </button>
      )}
    </div>
  )
}
