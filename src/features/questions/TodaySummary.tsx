import { CheckCircle2, Target } from 'lucide-react'
import { formatMinutes } from '../../lib/estimateMinutes'
import type { TodaySummary } from '../../lib/todaySummary'

// 今日の一手サマリ（study-time-scarcity.md 課題9）。復習タブの最上部の1行。
//
// 「開いた瞬間に、今日いくらやれば良くて、いまどこにいるか」だけを答える。
// 内訳・グラフ・遷移は持たない（それは分析タブの役割で、週末のレビュー用に現状維持）。
// 値の組み立ては lib/todaySummary.ts（純関数）。
export default function TodaySummaryBar({ summary }: { summary: TodaySummary }) {
  const { done, remainingCount, remainingMinutes, hasData, estimate, targetScore, pointGap, achieved } = summary

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
      {done ? (
        <span className="flex items-center gap-1.5 font-medium text-emerald-600">
          <CheckCircle2 size={14} />
          今日の分は完了
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-gray-600">
          <Target size={14} className="text-gray-400" />
          今日の残り
          <span className="font-bold text-gray-800">約{formatMinutes(remainingMinutes)}</span>
          <span className="text-gray-400">（{remainingCount}問）</span>
        </span>
      )}

      {hasData && (
        <>
          <span className="text-gray-200">·</span>
          <span className="text-gray-600">
            想定得点 <span className="font-bold text-gray-800">{estimate}点</span>
          </span>
          <span className="text-gray-200">·</span>
          {achieved ? (
            <span className="font-medium text-emerald-600">目標{targetScore}点に到達</span>
          ) : (
            <span className="text-gray-600">
              合格まであと <span className="font-bold text-blue-600">{pointGap}点</span>
            </span>
          )}
        </>
      )}
    </div>
  )
}
