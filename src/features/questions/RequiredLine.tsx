import type { ForecastDay, RequiredPace } from '../../lib/reviewForecast'
import { formatMD } from '../../lib/date'

// 合格に必要なライン（review-schedule-realism.md §3-2・2026-10-01）。
//
// **時間も実績ペースも使わない。** 利用者が消化できるかどうかに関わらず、試験までに
// 必要な量をそのまま出す。実績で能力を決めると、消化できなかった分だけ要求が下がって見える。
// 数値はすべて純関数（reviewForecast）の値で、ここでは並べて表示するだけ。
//
//   1行目 必要ペース ◯問/日（試験まで◯日）            ← 総量 ÷ 日数。ペースに依存しない
//   2行目 14日先まで「予定どおりにやった場合」の件数   ← 溜まりは今日に全部数える

export default function RequiredLine({
  pace, forecast, newPerDay, daysToExam,
}: {
  pace: RequiredPace | null
  forecast: ForecastDay[]
  /** 1日に着手する未着手（policy.requiredPaceQ）。 */
  newPerDay: number
  daysToExam: number | null
}) {
  if (!pace || pace.days <= 0) return null
  const max = Math.max(1, ...forecast.map(d => d.total))

  return (
    <div className="px-4 py-2 space-y-1.5">
      <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap text-[11px]">
        <span className="text-gray-400">合格に必要なペース</span>
        <span className="text-sm font-bold text-gray-700 tabular-nums">約{pace.perDay.toFixed(1)}</span>
        <span className="text-gray-500">問/日</span>
        {daysToExam !== null && <span className="text-gray-400">· 試験まで{daysToExam}日</span>}
        <span className="text-gray-400">
          · 復習{pace.scheduledReviews}回＋未着手の着手・再演習{pace.newWork}回
        </span>
        {newPerDay > 0 && (
          <span className="text-gray-400">· 新規着手 {newPerDay}問/日</span>
        )}
      </div>

      {forecast.length > 0 && (
        <div className="overflow-x-auto -mx-0.5 px-0.5">
          <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
            {forecast.map((d, i) => (
              <div
                key={d.date}
                title={`${formatMD(d.date)}: 復習${d.reviews}＋新規${d.newStarts}＋再演習${d.followUps}`}
                className="flex flex-col items-center min-w-[34px]"
              >
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{i === 0 ? '今日' : formatMD(d.date)}</span>
                <div className="w-full h-6 flex items-end">
                  <div
                    className={`w-full rounded-sm ${i === 0 ? 'bg-blue-500' : 'bg-blue-200'}`}
                    style={{ height: `${Math.max(8, Math.round((d.total / max) * 100))}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-gray-600 tabular-nums">{d.total}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-300 mt-0.5">予定どおりにやった場合（溜まりは今日に全部・復習＋新規＋再演習）</p>
        </div>
      )}
    </div>
  )
}
