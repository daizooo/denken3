import { CalendarDays, CheckCircle2, ChevronDown } from 'lucide-react'
import { formatMinutes } from '../../lib/estimateMinutes'
import type { TodaySummary } from '../../lib/todaySummary'
import type { TodayPlan } from '../../lib/planToday'

// 今日パネル（learning-metrics-ui-redesign / 課題14）。復習タブの最上部の1枚。
//
// 統合前は「ヘッダの今日の学習」「今日の一手バー」「時間予算バー」「日付ストリップ」の
// 4面に指標が散っており、39問（今日の推奨）と109問（期限到来の総数）と221分と461分が
// 主従なしに同一画面へ並んでいた（同じ数値の重複が3組）。
//
// ここでは1枚のカードに「何をどれだけ・いまどこ・どう始める・いつの分」だけを縦に積む:
//   1行目 今日やること 39問・約221分        （＋想定得点は右端の従属表示）
//   2行目 進捗バー（今日 12問 完了）
//   3行目 内訳（前進 3 / 維持 5 · 順番待ち 103）   ← Phase B-3
//   4行目 時間で選ぶ 5/15/30/すべて
//   5行目 先の予定（既定は畳む）
// 数値の計算は増やさない。すべて既存の純関数（todaySummary / planToday）の値。
//
// 【Phase B-3】3行目を足した理由（設計書 §3.5）。今日のラインは総量を減らす仕組みでは
// なく、順序を決めるだけの線である。線より下が「消えた」のか「順番待ち」なのかが画面に
// 出ていないと、利用者には量を削られたようにしか見えない ―― 逆に、順番待ちが見えないまま
// 減った数字だけを出すのは、目標を下げることと体感上は同じになる（原則 §0）。
// だから「翌日以降に必ず戻る」ことを件数つきで明示する。
const BUDGET_OPTIONS: { minutes: number | null; label: string }[] = [
  { minutes: 5, label: '5分' },
  { minutes: 15, label: '15分' },
  { minutes: 30, label: '30分' },
  { minutes: null, label: 'すべて' },
]

export interface DateSlot {
  date: string
  label: string
  count: number
}

export default function TodayPanel({
  summary, plan, isToday, dateLabel,
  queueCount, queueMinutes,
  budget, onBudgetChange,
  dates, selectedDate, onSelectDate, datesOpen, onToggleDates,
}: {
  summary: TodaySummary
  /** 今日のライン（planToday・Phase B-1）。内訳と順番待ちの件数に使う。 */
  plan: TodayPlan
  /** 表示中の日付が今日か。今日以外は進捗・得点を出さない（今日の概念のため）。 */
  isToday: boolean
  /** 今日以外のときの見出し（例: 9/5）。 */
  dateLabel: string
  /** いま一覧に出ている問題数と、その推定所要分。 */
  queueCount: number
  queueMinutes: number
  budget: number | null
  onBudgetChange: (minutes: number | null) => void
  dates: DateSlot[]
  selectedDate: string
  onSelectDate: (date: string) => void
  datesOpen: boolean
  onToggleDates: () => void
}) {
  const { done, remainingCount, remainingMinutes, doneCount, hasData, estimate, pointGap, achieved } = summary
  const totalToday = doneCount + remainingCount
  const percent = totalToday === 0 ? 100 : Math.round((doneCount / totalToday) * 100)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
      {/* 1行目: 今日やること（主）＋ 想定得点（従） */}
      <div className="px-4 py-2.5 flex items-baseline gap-x-2 gap-y-1 flex-wrap">
        {!isToday ? (
          <span className="text-sm text-gray-700">
            <span className="font-bold">{dateLabel}</span> の復習予定
            <span className="ml-2 font-bold text-gray-800">{queueCount}問</span>
            <span className="ml-1 text-xs text-gray-400">約{formatMinutes(queueMinutes)}</span>
          </span>
        ) : done ? (
          <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600">
            <CheckCircle2 size={16} />
            今日の分は完了
          </span>
        ) : (
          <span className="text-sm text-gray-500">
            今日やること
            <span className="ml-2 text-lg font-bold text-gray-800 tabular-nums">{remainingCount}</span>
            <span className="ml-0.5 text-gray-500">問</span>
            <span className="ml-2 text-gray-300">·</span>
            <span className="ml-2 font-bold text-gray-700">約{formatMinutes(remainingMinutes)}</span>
          </span>
        )}

        {isToday && hasData && (
          <span className="ml-auto text-[11px] text-gray-400 whitespace-nowrap">
            想定 <span className="font-bold text-gray-600">{estimate}点</span>
            <span className="mx-1 text-gray-200">·</span>
            {achieved
              ? <span className="font-medium text-emerald-600">目標到達</span>
              : <>合格まで <span className="font-bold text-blue-600">{pointGap}点</span></>}
          </span>
        )}
      </div>

      {/* 2行目: 今日の進捗。「終わりが見える」ことだけを担う（今日のみ）。 */}
      {isToday && (
        <div className="px-4 py-2 flex items-center gap-2.5">
          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-400 whitespace-nowrap tabular-nums">
            {doneCount}/{totalToday}問 完了
          </span>
        </div>
      )}

      {/* 3行目: 今日の内訳と順番待ち（Phase B-3）。順番待ちは"遅れ"ではない。 */}
      {isToday && plan.totalCount > 0 && (
        <div className="px-4 py-2 flex items-baseline gap-x-2 gap-y-1 flex-wrap text-[11px]">
          <span className="text-gray-400">内訳</span>
          <span className="text-gray-500">
            前進 <span className="font-bold text-gray-700 tabular-nums">{plan.forwardCount}</span>問
            <span className="mx-1 text-gray-200">·</span>
            維持 <span className="font-bold text-gray-700 tabular-nums">{plan.maintainCount}</span>問
          </span>
          {plan.waitingCount > 0 && (
            <span className="text-gray-400">
              <span className="mx-1 text-gray-200">/</span>
              順番待ち <span className="font-bold text-gray-600 tabular-nums">{plan.waitingCount}</span>問
              （約{formatMinutes(plan.waitingMinutes)}）· 翌日以降に戻ります
            </span>
          )}
          {plan.urgentCount > 0 && (
            <span className="text-red-500">
              <span className="mx-1 text-gray-200">/</span>
              優先 <span className="font-bold tabular-nums">{plan.urgentCount}</span>問は時間に関わらず必ず出します
            </span>
          )}
        </div>
      )}

      {/* 4行目: 時間で選ぶ。予算を選ぶと一覧が「点数影響÷所要分」の降順になり、線が引かれる。 */}
      {queueCount > 0 && (
        <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 whitespace-nowrap">時間で選ぶ</span>
          <div className="flex gap-1">
            {BUDGET_OPTIONS.map(o => {
              const on = budget === o.minutes
              return (
                <button
                  key={o.label}
                  onClick={() => onBudgetChange(o.minutes)}
                  className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
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
          {/* 予算を選んだときだけ結果を出す。未選択時に一覧の総数（109問・461分）を併記すると、
              主数値（今日39問・221分）と競合して「今日はどっち」が読めなくなるため出さない。
              一覧の総数は章セレクトが、今日ぶんとの境界は一覧内の区切り線が担う。 */}
          {isToday && budget !== null && (
            <span className="text-[11px] text-gray-400">
              {plan.waitingCount > 0
                ? <>この{budget}分で <span className="font-bold text-gray-600">{plan.recommendedCount}問</span>（約{formatMinutes(plan.recommendedMinutes)}）</>
                : <>{budget}分で全{plan.totalCount}問（約{formatMinutes(plan.totalMinutes)}）</>}
              {/* 切れない分（忘却が進んだコア＝🔴優先と、最低ラインの1問）は予算を超えても
                  線の上に残す（設計書 §3.5 ①③）。黙って超過させると「選んだ予算と違う」に
                  なるので、超えていることを出す。 */}
              {plan.overBudget && (
                <span className="ml-1 text-red-500">切れない分で予算を超えています</span>
              )}
            </span>
          )}
        </div>
      )}

      {/* 5行目: 先の予定。既定は畳む（今日を見ている限り不要な行のため）。 */}
      <div className="px-4 py-1.5">
        <button
          onClick={onToggleDates}
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600"
        >
          <CalendarDays size={12} />
          先の予定
          <ChevronDown size={12} className={`transition-transform ${datesOpen ? 'rotate-180' : ''}`} />
        </button>

        {datesOpen && (
          <div className="overflow-x-auto pt-1.5 pb-0.5 -mx-0.5 px-0.5">
            <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
              {dates.map(d => (
                <button
                  key={d.date}
                  onClick={() => onSelectDate(d.date)}
                  className={`flex flex-col items-center px-2.5 py-1 rounded-lg border text-[11px] transition-colors min-w-[48px] ${
                    selectedDate === d.date
                      ? 'bg-blue-600 text-white border-blue-600'
                      : d.count > 0
                      ? 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      : 'bg-gray-50 text-gray-300 border-gray-100'
                  }`}
                >
                  <span className="whitespace-nowrap">{d.label}</span>
                  <span className={`font-bold ${
                    selectedDate === d.date ? 'text-white' : d.count > 0 ? 'text-gray-700' : 'text-gray-300'
                  }`}>{d.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
