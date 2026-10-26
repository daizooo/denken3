// 選択式の空欄を1問として解く画面（肢モード ItemSolver の選択式版）。
//
//   1. 空欄を含む文を表示し、語群から1語を選ぶ。「答える」「自信なしで答える」「分からない」で確定
//   2. 確定した時点で正誤を出し、正解の語と解説を表示（確定後は変更不可、誤タップは「修正」で取り消しのみ）
//   3. 理解度は択一式の肢と同じ写像（正解×確信=A、正解×迷い=B、不正解・分からない=C）で自動記録
//
// 記録は呼び出し側（App の updateStatus = 既存の reviews / FSRS の経路）に渡す。
// 本文・正答が取れない、出題対象外（law_status≠ok）の空欄は出題しない。
import { useState } from 'react'
import { X } from 'lucide-react'
import type { Status } from '../../domain/types'
import type { Attempt, Confidence } from '../../lib/attempt'
import { parseItemId } from '../../domain/license'
import { statusFromAttempt } from '../../lib/license/attempt'
import { correctWordNo, isAskableSentaku, sentakuAttempt, sentakuQuestionId, splitBlanks, wordChoices } from '../../lib/license/sentakuItem'
import { titleJa } from '../../lib/license/idLabel'
import { STATUS_BG } from '../shared/status'
import { useItemBodies } from './useItemBodies'
import { useSentakuSpec } from './useSentakuSpec'

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
const circled = (n: number) => (n >= 1 && n <= 20 ? CIRCLED[n - 1] : `(${n})`)

interface Committed {
  status: 'A' | 'B' | 'C'
  correct: boolean
  gaveUp: boolean
  picked: number | null
}

export default function SentakuSolver({
  itemId, title, userId, onRecord, onUndoRecord, onClose,
}: {
  itemId: string
  title: string
  userId: string
  onRecord: (status: Status, attempt: Attempt) => void
  onUndoRecord: () => void
  onClose: () => void
}) {
  const { bodies, loading: bodyLoading } = useItemBodies([itemId], userId)
  const { spec, loading: specLoading } = useSentakuSpec(sentakuQuestionId(itemId), userId)
  const body = bodies[itemId]
  const item = isAskableSentaku(body, spec) ? body : null
  const label = parseItemId(itemId)?.label ?? 'A'
  const correctNo = correctWordNo(spec, label)
  const choices = wordChoices(spec, label)

  const [picked, setPicked] = useState(0)
  const [committed, setCommitted] = useState<Committed | null>(null)

  const commit = (confidence: Confidence | undefined, gaveUp: boolean) => {
    if (!item || correctNo === null || committed || (!gaveUp && picked === 0)) return
    const attempt = sentakuAttempt(gaveUp ? null : picked, confidence, gaveUp, correctNo)
    const correct = attempt.correct === true
    const status = statusFromAttempt(correct, attempt.confidence, gaveUp)
    setCommitted({ status, correct, gaveUp, picked: gaveUp ? null : picked })
    onRecord(status, attempt)
  }

  const undo = () => {
    if (!committed) return
    onUndoRecord()
    setCommitted(null)
  }

  const wordOf = (no: number | null) => (no !== null && spec?.kind === 'sentaku' ? spec.wordbank[String(no)] ?? '' : '')
  const btn = 'py-3 rounded-lg border text-base font-bold disabled:opacity-40 transition'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-4">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">{titleJa(title)}</h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>

        {bodyLoading || (specLoading && !spec) ? (
          <p className="text-sm text-gray-500">本文を読み込み中…</p>
        ) : !item ? (
          <p className="text-sm text-gray-600">
            この空欄は出題できません（本文・正答が未取得・取得失敗、または法改正の確認待ち）。
            {typeof navigator !== 'undefined' && !navigator.onLine && ' オンラインに戻ってから開き直してください。'}
          </p>
        ) : (
          <>
            <p className="whitespace-pre-wrap leading-relaxed text-gray-900">
              {splitBlanks(item.statement).map((p, i) => {
                if ('text' in p) return <span key={i}>{p.text}</span>
                if (p.mark !== label) return <span key={i} className="text-gray-400">［{p.mark}］</span>
                return committed
                  ? <span key={i} className="font-bold text-green-700 underline">［{p.mark}］{wordOf(correctNo)}</span>
                  : <span key={i} className="font-bold text-indigo-700 bg-indigo-50 rounded px-0.5">［{p.mark}］</span>
              })}
            </p>

            <label className="block text-sm text-gray-600">
              空欄{label}に入る語句
              <select
                value={picked}
                disabled={!!committed}
                onChange={e => setPicked(Number(e.target.value))}
                className="mt-1 w-full border rounded px-2 py-2 bg-white text-base disabled:opacity-60"
              >
                <option value={0}>（選択してください）</option>
                {choices.map(c => <option key={c.no} value={c.no}>{circled(c.no)} {c.word}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button disabled={!!committed || picked === 0} onClick={() => commit('sure', false)} className={`${btn} bg-white text-gray-800 border-gray-300`}>答える</button>
              <button disabled={!!committed || picked === 0} onClick={() => commit('unsure', false)} className={`${btn} bg-white text-gray-800 border-gray-300`}>自信なしで答える</button>
            </div>
            <button
              disabled={!!committed}
              onClick={() => commit(undefined, true)}
              className="w-full py-2 text-sm rounded-lg border bg-white text-gray-800 border-gray-300 disabled:opacity-50"
            >分からない</button>

            {committed && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${committed.correct ? 'text-green-700' : 'text-red-700'}`}>
                    {committed.gaveUp ? '分からない' : committed.correct ? '正解' : '不正解'}
                  </span>
                  <span className="text-sm text-gray-600">正解は {circled(correctNo ?? 0)} {wordOf(correctNo)}</span>
                  <span className={`ml-auto text-xs border rounded px-2 py-0.5 ${STATUS_BG[committed.status]}`}>
                    {committed.status} を記録
                  </span>
                  <button onClick={undo} className="text-xs text-gray-500 underline">修正</button>
                </div>
                {!committed.gaveUp && !committed.correct && committed.picked !== null && (
                  <p className="text-sm text-gray-600">あなたの答え: {circled(committed.picked)} {wordOf(committed.picked)}</p>
                )}
                <div className="rounded-lg bg-gray-50 border p-3">
                  <p className="text-xs font-bold text-gray-500 mb-1">解説</p>
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{item.explanation?.trim() || '（解説なし）'}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
