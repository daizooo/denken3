import { ListOrdered } from 'lucide-react'
import type { ChapterPriorityRow } from '../../lib/chapterPriority'

// 章別の優先順位（課題15）。旧「得点を伸ばす近道」「章別 弱点ランキング」「章別進捗」を
// 1つの表に統合したもの。並びは伸びしろ（impact）降順で固定し、
// 「次にどの章をやるか」の答えを画面内で1つにする。値の組み立ては lib/chapterPriority.ts。
//
// 1行 = 章。左に順位と章名、右に伸びしろ（点）。その下に進捗バーと内訳、
// 着手済みなら弱点ランキングの一言を添える。
export default function ChapterPriorityTable({ rows }: { rows: ChapterPriorityRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1.5">
          <ListOrdered size={14} className="text-blue-500" />章別の優先順位
        </h3>
        <p className="text-xs text-gray-400">収録済みの問題がまだありません。</p>
      </div>
    )
  }

  const maxImpact = Math.max(...rows.map(r => r.impact), 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <ListOrdered size={14} className="text-blue-500" />章別の優先順位
        </h3>
        <span className="text-[10px] text-gray-400">伸びしろ順</span>
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => {
          const pct = r.total > 0 ? (r.mastered / r.total) * 100 : 0
          // 伸びしろの相対的な大きさ。上位の章がひと目で分かるようにバーの濃さで示す。
          const lead = maxImpact > 0 && r.impact >= maxImpact * 0.5
          return (
            <div key={r.code}>
              <div className="flex items-baseline justify-between text-xs gap-2">
                <span className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-[10px] text-gray-300 tabular-nums w-3.5 shrink-0">{i + 1}</span>
                  <span className="font-medium text-gray-700 truncate">{r.name}</span>
                </span>
                <span className={`whitespace-nowrap font-medium ${lead ? 'text-blue-600' : 'text-gray-400'}`}>
                  最大 +{r.impact.toFixed(1)}点
                </span>
              </div>

              {/* 進捗（完答 / 収録数）。章別進捗の役割をここが担う。 */}
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex items-baseline justify-between gap-2 mt-0.5">
                <span className="text-[11px] text-gray-400 truncate">
                  {r.advice ?? '未着手'}
                </span>
                <span className="text-[11px] text-gray-400 whitespace-nowrap tabular-nums">
                  {r.mastered}/{r.total}問 完答
                  {r.correctRate !== null && <> · 正答 {Math.round(r.correctRate * 100)}%</>}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-gray-300 mt-3">
        伸びしろ＝その章を全問A相当まで上げたときの想定得点への寄与。出題比率と現在の
        期待正答率から算出するため、弱くても出題の少ない章は下に来ます。
      </p>
    </div>
  )
}
