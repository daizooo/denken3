import { AlarmClock, Pause, Play, Timer } from 'lucide-react'
import { formatClock } from '../../lib/solveTimer'

// 「問題を解く」で開いている間の経過時間バー。
// ProblemViewer のトップバーに詰め込むと、狭い端末で問題名が読めなくなるため独立した行にする。
// 表示するのは3つだけ:
//   経過 / 切り上げ時間、切り上げ超過の警告、一時停止ボタン。
export default function SolveTimerBar({
  elapsedSec, cutoffSec, paused, overdue, onTogglePause,
}: {
  elapsedSec: number
  cutoffSec: number
  // 手動で止めているか。タブ非表示による自動停止はここには出さない
  // （画面が見えていない間の話なので、戻ったときには既に再開している）。
  paused: boolean
  // 切り上げ時間を過ぎたか（アラームが鳴った状態）。
  overdue: boolean
  onTogglePause: () => void
}) {
  // 進捗バーは切り上げ時間を 100% とする。超えたら満杯のまま赤で止める。
  const ratio = cutoffSec > 0 ? Math.min(elapsedSec / cutoffSec, 1) : 0

  return (
    <div className="shrink-0 bg-white/95 border-t border-gray-100">
      <div className="flex items-center gap-2 px-3 py-1.5">
        {overdue
          ? <AlarmClock size={14} className="text-red-500 shrink-0" />
          : <Timer size={14} className="text-gray-400 shrink-0" />}
        <span className={`font-mono text-sm font-bold tabular-nums ${
          overdue ? 'text-red-600' : paused ? 'text-gray-400' : 'text-gray-800'
        }`}>{formatClock(elapsedSec)}</span>
        <span className="font-mono text-[11px] tabular-nums text-gray-400">/ {formatClock(cutoffSec)}</span>
        {paused && <span className="text-[11px] font-medium text-gray-400">停止中</span>}
        {overdue && !paused && (
          <span className="text-[11px] font-medium text-red-600">切り上げて解答へ</span>
        )}
        <button
          onClick={onTogglePause}
          title={paused ? '計測を再開します' : '計測を止めます（ここまでの時間は残ります）'}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          {paused ? <><Play size={12} /> 再開</> : <><Pause size={12} /> 一時停止</>}
        </button>
      </div>
      {/* 残り時間の目安。数字を読まなくても、詰まってきたことが視野の端で分かる。 */}
      <div className="h-0.5 bg-gray-100">
        <div
          className={`h-full transition-[width] duration-1000 ease-linear ${
            overdue ? 'bg-red-500' : paused ? 'bg-gray-300' : 'bg-blue-500'
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}
