// 1級土木「入門」の○×一問一答を1問解く（docs/design/doboku1-primer.md）。
//   1. 記述を読み ○／× を選び「自信あり／迷いあり」で決定（解答前コミット）。「分からない」も可
//   2. 決定した時点で正誤と理解度（A/B/C）を記録し、解説を出す。誤タップは「修正」で取り消す
import { useState } from 'react'
import type { Attempt, Confidence } from '../../lib/attempt'
import { statusOfAttempt } from '../../lib/doboku1/record'
import { maruBatsuAttempt } from '../../data/doboku1/primer/index'
import type { D1PrimerQuiz } from '../../data/doboku1/primer/types'
import { STATUS_BG } from '../shared/status'

export default function Doboku1PrimerSolver({ heading, quiz, onRecord, onUndo, onClose }: {
  heading: string
  quiz: D1PrimerQuiz
  onRecord: (attempt: Attempt) => void
  onUndo: () => void
  onClose: () => void
}) {
  const [picked, setPicked] = useState<boolean | null>(null)
  const [done, setDone] = useState<Attempt | null>(null)

  const commit = (pick: boolean | null, confidence?: Confidence) => {
    if (done) return
    const a = maruBatsuAttempt(pick, confidence, quiz.answer)
    setDone(a)
    onRecord(a)
  }
  const undo = () => { setDone(null); setPicked(null); onUndo() }

  const btnCls = (v: boolean) => {
    if (done) {
      if (v === quiz.answer) return 'bg-green-50 border-green-400'
      if (picked === v) return 'bg-red-50 border-red-400'
      return 'bg-white border-gray-200 opacity-70'
    }
    return picked === v ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
  }

  return (
    <div className="space-y-4">
      <div className="text-xs font-bold text-gray-700">{heading}</div>
      <p className="whitespace-pre-wrap leading-relaxed text-gray-900">{quiz.statement}</p>

      <div className="grid grid-cols-2 gap-2">
        {([true, false] as const).map(v => (
          <button key={String(v)} disabled={!!done} onClick={() => setPicked(v)} aria-label={v ? '正しい（○）' : '誤り（×）'}
            className={`rounded-lg border py-3 text-2xl font-bold text-gray-900 transition-colors ${btnCls(v)}`}>
            {v ? '○' : '×'}
          </button>
        ))}
      </div>

      {!done ? (
        <div className="grid grid-cols-3 gap-2">
          <button disabled={picked === null} onClick={() => commit(picked, 'sure')}
            className="rounded-lg bg-blue-700 px-2 py-2.5 text-sm font-bold text-white disabled:opacity-40">自信ありで決定</button>
          <button disabled={picked === null} onClick={() => commit(picked, 'unsure')}
            className="rounded-lg border border-blue-700 px-2 py-2.5 text-sm font-bold text-blue-800 disabled:opacity-40">迷いありで決定</button>
          <button onClick={() => commit(null)}
            className="rounded-lg border border-gray-300 px-2 py-2.5 text-sm text-gray-700">分からない</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-lg font-bold ${done.correct ? 'text-green-700' : 'text-red-700'}`}>
              {done.gaveUp ? '分からない' : done.correct ? '正解' : '不正解'}
            </span>
            <span className="text-sm text-gray-600">正答は {quiz.answer ? '○' : '×'}</span>
            <span className={`ml-auto rounded border px-2 py-0.5 text-xs ${STATUS_BG[statusOfAttempt(done)]}`}>{statusOfAttempt(done)} を記録</span>
            <button onClick={undo} className="text-xs text-gray-500 underline">修正</button>
          </div>
          <div className="rounded-lg bg-blue-50 p-3 text-sm leading-relaxed text-gray-800">
            <p><span className="font-bold">解説 </span>{quiz.explain}</p>
            <p className="mt-1 text-[11px] text-gray-500">Claude 作成・根拠未確認（根拠は上の入門ノートの末尾）</p>
          </div>
          <button onClick={onClose} className="w-full rounded-lg bg-gray-800 py-2.5 text-sm font-bold text-white">閉じる</button>
        </div>
      )}
    </div>
  )
}
