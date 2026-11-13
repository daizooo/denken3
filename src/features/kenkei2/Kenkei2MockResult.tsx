// 本番形式模試の結果（docs/design/kenkei2.md §7 K6）。合計点・合否・大問ごとの得点、問ごとの○×、答え合わせ（正答つき）。
import { useState } from 'react'
import type { Kk2Row } from '../../lib/kenkei2/cards'
import { KK2_MOCK, cardLabel, emptyCardDraft, type CardDraft, type MockAnswers, type MockScore } from '../../lib/kenkei2/mock'
import CardAnswerForm from './CardAnswerForm'

const PART_NAME: Record<string, string> = { '1': '仕訳', '2': '金額', '3': '原価計算など', '4': '原価計算など', '5': '精算表' }

export default function Kenkei2MockResult({ kai, rows, answers, score, recorded, onBack }: {
  kai: number
  rows: Kk2Row[]
  answers: MockAnswers
  score: MockScore
  /** 復習に入れた問の数（受験直後だけ。結果の見直しでは undefined）。 */
  recorded?: number
  onBack: () => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const byId = new Map(rows.map(r => [r.id, r]))
  const open = openId ? byId.get(openId) : undefined
  const openScore = score.cards.find(c => c.id === openId)
  const noop = () => {}

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${score.passed ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
        <div className="text-xs text-gray-600">第{kai}回 本番形式模試の結果</div>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums text-gray-900">{score.total}<span className="text-base font-normal text-gray-500"> / {score.max} 点</span></span>
          <span className={`text-lg font-bold ${score.passed ? 'text-green-700' : 'text-red-700'}`}>{score.passed ? '合格ライン到達' : '合格ライン未達'}</span>
          <span className="text-xs text-gray-500">（{KK2_MOCK.passScore}点以上で合格。配点は資格スクール大栄の予想・合格基準は公式で未確認）</span>
        </div>
        {recorded !== undefined && (
          <p className="mt-1 text-xs text-gray-600">誤答・未解答の {recorded} 問を復習に入れました（理解度 C）。</p>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 text-xs text-gray-600">
            <th className="border border-gray-200 px-2 py-1 text-left">問題</th>
            <th className="border border-gray-200 px-2 py-1 text-right">得点</th>
            <th className="border border-gray-200 px-2 py-1">結果</th>
            <th className="border border-gray-200 px-2 py-1" />
          </tr>
        </thead>
        <tbody>
          {score.cards.map(c => (
            <tr key={c.id}>
              <td className="border border-gray-200 px-2 py-1">{cardLabel(c)}　<span className="text-xs text-gray-400">{PART_NAME[String(c.part)]}</span></td>
              <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{c.earned} / {c.max}</td>
              <td className={`border border-gray-200 px-2 py-1 text-center font-bold ${c.correct ? 'text-green-700' : 'text-red-700'}`}>{c.correct ? '○' : '×'}</td>
              <td className="border border-gray-200 px-2 py-1 text-center">
                <button onClick={() => setOpenId(c.id)} className="text-xs text-blue-700 underline">答え合わせ</button>
              </td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-bold">
            <td className="border border-gray-200 px-2 py-1">合計</td>
            <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{score.total} / {score.max}</td>
            <td className="border border-gray-200 px-2 py-1" colSpan={2} />
          </tr>
        </tbody>
      </table>

      <button onClick={onBack} className="w-full rounded-lg bg-gray-800 py-2.5 text-sm font-bold text-white">模試の一覧へ戻る</button>

      {open && openScore && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true">
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-5xl sm:rounded-2xl">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="flex-1 text-sm font-bold text-gray-700">{cardLabel(open)}　{openScore.earned} / {openScore.max} 点</h3>
              <button onClick={() => setOpenId(null)} className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700">閉じる</button>
            </div>
            <CardAnswerForm row={open} draft={(answers[open.id] ?? emptyCardDraft()) as CardDraft} setDraft={noop} result={openScore.result} />
          </div>
        </div>
      )}
    </div>
  )
}
