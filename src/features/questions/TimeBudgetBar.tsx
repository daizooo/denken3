import { Clock } from 'lucide-react'
import { formatMinutes } from '../../lib/estimateMinutes'

// 時間予算モードのチップ（study-time-scarcity.md 課題1・提案B）。
//
// 「いま何分ある？」に答えるだけで、その予算で期待得点の伸びが最大になるセットが出る。
// 予算を選ぶと、キューは「価値 ÷ 推定所要分」の降順に並び替わり、累積の推定所要が
// 予算に達したところに線が引かれる（現行の推奨ラインの一般化であり、新しい概念を増やさない）。
//
// 刻みは 5分 / 15分 / 30分 / 指定なし（設計書 §6-3 の決定事項）。
// 運用して問題が出たらここを直す。
const BUDGET_OPTIONS: { minutes: number | null; label: string }[] = [
  { minutes: 5, label: '5分' },
  { minutes: 15, label: '15分' },
  { minutes: 30, label: '30分' },
  { minutes: null, label: '指定なし' },
]

export default function TimeBudgetBar({
  value, onChange, fitCount, fitMinutes, totalCount, totalMinutes,
}: {
  value: number | null           // 選択中の予算（分）。null＝指定なし
  onChange: (minutes: number | null) => void
  fitCount: number               // 予算に収まる問題数
  fitMinutes: number             // その推定所要分
  totalCount: number             // キュー全体の問題数
  totalMinutes: number           // キュー全体の推定所要分
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600 whitespace-nowrap">
          <Clock size={14} className="text-gray-400" />
          いま何分ある？
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {BUDGET_OPTIONS.map(o => {
            const on = value === o.minutes
            return (
              <button
                key={o.label}
                onClick={() => onChange(o.minutes)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  on
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 選択結果の要約。指定なしのときはキュー全体の推定所要だけを出す。 */}
      <p className="mt-1.5 text-[11px] text-gray-500">
        {value === null ? (
          totalCount > 0 && <>この一覧 {totalCount}問 · 推定 約{formatMinutes(totalMinutes)}</>
        ) : fitCount >= totalCount ? (
          <>{value}分で全{totalCount}問（推定 約{formatMinutes(totalMinutes)}）</>
        ) : (
          <>
            {value}分で <span className="font-bold text-gray-700">{fitCount}問</span>
            （推定 約{formatMinutes(fitMinutes)}）· 全{totalCount}問なら 約{formatMinutes(totalMinutes)}
          </>
        )}
      </p>
    </div>
  )
}
