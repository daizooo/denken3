// 1級土木の四肢択一を1問解く（docs/design/doboku1-ichiji.md §6.5）。
//   1. 問題文・①〜④・⑴〜⑷ を表示。肢を選び「自信あり／迷いあり」で決定（解答前コミット）。「分からない」も可
//   2. 決定した時点で正誤と理解度（A/B/C）を記録し、図解解説を出す。誤タップは「修正」で取り消す
import { useState } from 'react'
import type { DbkQuestionRow } from '../../lib/doboku1/types'
import type { Attempt, Confidence } from '../../lib/attempt'
import { CHOICE_LABELS, STATEMENT_LABELS } from '../../lib/doboku1/explain'
import { choiceAttempt, statusOfAttempt } from '../../lib/doboku1/record'
import { STATUS_BG } from '../shared/status'
import ExplainView from './ExplainView'
import Doboku1Figure from './Doboku1Figure'
import Doboku1CopyButton from './Doboku1CopyButton'

export default function Doboku1Solver({ userId, q, onRecord, onUndo, onNext, hasNext }: {
  userId: string
  q: DbkQuestionRow
  onRecord: (attempt: Attempt) => void
  onUndo: () => void
  onNext: () => void
  hasNext: boolean
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const [done, setDone] = useState<Attempt | null>(null)
  const table = q.choice_header.length >= 2

  const commit = (choice: number | null, confidence?: Confidence) => {
    if (done) return
    const a = choiceAttempt(choice, confidence, q.correct)
    setDone(a)
    onRecord(a)
  }
  const undo = () => { setDone(null); setPicked(null); onUndo() }

  const rowCls = (i: number) => {
    const n = i + 1
    if (done) {
      if (n === q.correct) return 'bg-green-50 border-green-400'
      if (done.selected?.[0] === n) return 'bg-red-50 border-red-400'
      return 'bg-white border-gray-200 opacity-70'
    }
    return picked === n ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="font-bold text-gray-700">{q.year} 試験問題{q.paper} No.{q.q_no}</span>
        <span>{q.group_label}</span>
        <Doboku1CopyButton q={q} />
      </div>

      <p className="whitespace-pre-wrap leading-relaxed text-gray-900">{q.stem}</p>
      {q.has_figure && <Doboku1Figure userId={userId} questionId={q.id} />}

      {q.statements.length > 0 && (
        <ol className="space-y-1">
          {q.statements.map((s, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-900"><span className="font-bold">{STATEMENT_LABELS[i]}</span><span>{s}</span></li>
          ))}
        </ol>
      )}

      <div className="space-y-2">
        {table && (
          <div className="grid gap-2 px-3 text-xs font-bold text-gray-500" style={{ gridTemplateColumns: `2rem repeat(${q.choice_header.length}, minmax(0, 1fr))` }}>
            <span />
            {q.choice_header.map((h, i) => <span key={i}>{h}</span>)}
          </div>
        )}
        {q.choices.map((c, i) => (
          <button
            key={i}
            disabled={!!done}
            onClick={() => setPicked(i + 1)}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm text-gray-900 transition-colors ${rowCls(i)}`}
          >
            {table ? (
              <span className="grid gap-2" style={{ gridTemplateColumns: `2rem repeat(${c.length}, minmax(0, 1fr))` }}>
                <span className="font-bold">{CHOICE_LABELS[i]}</span>
                {c.map((cell, j) => <span key={j}>{cell}</span>)}
              </span>
            ) : (
              <span className="flex gap-2"><span className="font-bold">{CHOICE_LABELS[i]}</span><span>{c.join(' ')}</span></span>
            )}
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
            <span className="text-sm text-gray-600">正答は {CHOICE_LABELS[q.correct - 1]}</span>
            <span className={`ml-auto rounded border px-2 py-0.5 text-xs ${STATUS_BG[statusOfAttempt(done)]}`}>{statusOfAttempt(done)} を記録</span>
            <button onClick={undo} className="text-xs text-gray-500 underline">修正</button>
          </div>
          <ExplainView explain={q.explain} verified={q.explain_verified} correctLabel={q.kind === 'statements' ? undefined : CHOICE_LABELS[q.correct - 1]} />
          <button onClick={onNext} className="w-full rounded-lg bg-gray-800 py-2.5 text-sm font-bold text-white">
            {hasNext ? '次の問題へ' : '一覧に戻る'}
          </button>
        </div>
      )}
    </div>
  )
}
