import { Eye, HelpCircle } from 'lucide-react'
import { CHOICES, isComplete } from '../../lib/attempt'

// 解答前コミットの下部バー（docs/design/calculation-active-learning.md §2.1）。
//
// 「解答を見る」を無条件では押せなくし、選択肢を1つ確定させるか「わからない」を通す。
// 解答を見た後に理解度を付ける現行の順序では、後知恵バイアス（「あ、そう解くんだった＝A」）を
// 構造的に防げないため、コミットを先に置く。
//
// 数値入力（テンキー）ではなく選択肢にしているのは、本番CBTと同一形式であること・
// 1タップで済むこと・表記ゆれの自己採点が不要になることによる（設計 §2.2）。
// ボタンは CBTRunner の5択と同じ 44px 角で、片手・親指操作を前提にする。
export default function AnswerBar({
  partCount, selected, onSelect, onReveal, onGiveUp,
}: {
  /** 小問数。B問題は 2（(a)(b)）。 */
  partCount: 1 | 2
  /** 選択中の番号（未選択は 0）。長さは partCount。 */
  selected: number[]
  onSelect: (partIdx: number, value: number) => void
  /** 解答を表示する（全小問を選び終えたときだけ活性）。 */
  onReveal: () => void
  /** 「わからない」。解答を表示し、理解度 C を即時記録する。 */
  onGiveUp: () => void
}) {
  const ready = isComplete(selected)

  return (
    <div className="shrink-0 bg-white/95 border-t border-gray-100 px-3 py-2 space-y-2">
      {/* 選択肢（B問題は (a)(b) の2行） */}
      {Array.from({ length: partCount }, (_, pi) => (
        <div key={pi} className="flex items-center gap-1.5">
          {partCount > 1 && (
            <span className="text-[11px] font-medium text-gray-500 w-6 shrink-0">
              {pi === 0 ? '(a)' : '(b)'}
            </span>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {CHOICES.map(v => {
              const chosen = selected[pi] === v
              return (
                <button
                  key={v}
                  onClick={() => onSelect(pi, v)}
                  className={`w-11 h-11 rounded-xl text-sm font-bold border-2 transition-colors ${
                    chosen
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
                >{v}</button>
              )
            })}
          </div>
        </div>
      ))}

      {/* 確定 / 降参。降参は現行より1タップ少ない最短経路にする（設計 §2.3）。 */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onGiveUp}
          title="解答を表示し、理解度 C（答えを見た）として記録します"
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          <HelpCircle size={14} /> わからない
        </button>
        <button
          onClick={onReveal}
          disabled={!ready}
          title={ready ? '解答を表示します' : 'まず選択肢を選んでください'}
          className={`ml-auto flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold border-2 transition-colors ${
            ready
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed'
          }`}
        >
          <Eye size={14} /> 解答を見る
        </button>
      </div>
    </div>
  )
}
