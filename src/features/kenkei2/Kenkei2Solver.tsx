// 2級建設業経理士を1カード解く（docs/design/kenkei2.md §4）。
//   1. 問題文を読み、画面の解答欄に入力する（紙は使わない。計算はメモ欄。下書きは自動保存）
//   2. 「自信あり／迷いあり」で採点 → ○×と正答、得点を出す。理解度（A/B/C）を記録する。誤りは「修正」で取り消す
import { useState } from 'react'
import type { Attempt, Confidence } from '../../lib/attempt'
import { gradeCard, passRateOf, type CardResult, type Kk2Row } from '../../lib/kenkei2/cards'
import { scoredAttempt, statusOfAttempt } from '../../lib/kenkei2/record'
import { STATUS_BG } from '../shared/status'
import CardAnswerForm from './CardAnswerForm'
import { useDraft } from './useDraft'

export default function Kenkei2Solver({ userId, row, onRecord, onUndo, onClose }: {
  userId: string
  row: Kk2Row
  onRecord: (attempt: Attempt) => void
  onUndo: () => void
  onClose: () => void
}) {
  const { draft, setDraft, clear, resume } = useDraft(userId, row.id)
  const [result, setResult] = useState<CardResult | null>(null)
  const [done, setDone] = useState<Attempt | null>(null)
  const passRate = passRateOf(row)

  const commit = (confidence?: Confidence, gaveUp = false) => {
    if (done) return
    const res = gradeCard(row, gaveUp ? { answers: {} } : { answers: draft.answers, journal: draft.journal })
    const a = scoredAttempt(res.rate, confidence, { passRate, gaveUp })
    setResult(res)
    setDone(a)
    clear()
    onRecord(a)
  }
  const undo = () => { resume(); setDraft(d => ({ ...d })); setResult(null); setDone(null); onUndo() }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="font-bold text-gray-700">第{row.exam_no}回 第{row.part}問{row.part <= 2 ? `(${row.sub})` : ''}</span>
        <span>{row.points}点（配点は資格スクール大栄の予想）</span>
        {passRate < 1 && <span>得点率 {Math.round(passRate * 100)}% 以上で正解扱い</span>}
      </div>

      <CardAnswerForm row={row} draft={draft} setDraft={setDraft} result={result} />

      {!done ? (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => commit('sure')} className="rounded-lg bg-blue-700 px-2 py-2.5 text-sm font-bold text-white">自信ありで採点</button>
          <button onClick={() => commit('unsure')} className="rounded-lg border border-blue-700 px-2 py-2.5 text-sm font-bold text-blue-800">迷いありで採点</button>
          <button onClick={() => commit(undefined, true)} className="rounded-lg border border-gray-300 px-2 py-2.5 text-sm text-gray-700">分からない</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-lg font-bold ${done.correct ? 'text-green-700' : 'text-red-700'}`}>
              {done.gaveUp ? '分からない' : done.correct ? '正解' : '不正解'}
            </span>
            {result && !done.gaveUp && <span className="text-sm text-gray-700 tabular-nums">{result.earned} / {result.max} 点</span>}
            <span className={`ml-auto rounded border px-2 py-0.5 text-xs ${STATUS_BG[statusOfAttempt(done)]}`}>{statusOfAttempt(done)} を記録</span>
            <button onClick={undo} className="text-xs text-gray-500 underline">修正</button>
          </div>
          <button onClick={onClose} className="w-full rounded-lg bg-gray-800 py-2.5 text-sm font-bold text-white">閉じる</button>
        </div>
      )}
    </div>
  )
}
