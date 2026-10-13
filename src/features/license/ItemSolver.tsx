// 肢モード（一問一答）— licensehub-expansion.md §6.1。
//
//   1. 肢の本文を表示。○/× と 確信/迷い を選ぶ
//   2. 「解答する」で確定（解答前コミット）。確定後は変更不可、誤タップは「修正」で取り消しのみ
//   3. truth と照合して正誤を出し、解説を表示
//   4. 理解度を自動記録（§6.2: 正解×確信=A、正解×迷い=B、不正解・分からない=C）
//   5. 「テキストをコピー」（§6.3 の単体コピー）
//
// 記録は呼び出し側（App の updateStatus = 既存の reviews / FSRS の経路）に渡す。
// 本文が無い・取得できない・出題対象外（truth=null、law_status≠ok）の肢は出題しない。
import { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import type { Status } from '../../domain/types'
import type { Attempt, Confidence } from '../../lib/attempt'
import { isAskableItem } from '../../lib/license/itemBody'
import { itemAttempt, statusFromAttempt } from '../../lib/license/attempt'
import { formatItemForClipboard, truthLabel } from '../../lib/license/itemText'
import { STATUS_BG } from '../shared/status'
import { useItemBodies } from './useItemBodies'

interface Committed {
  status: 'A' | 'B' | 'C'
  correct: boolean
  gaveUp: boolean
}

export default function ItemSolver({
  itemId, title, userId, onRecord, onUndoRecord, onClose,
}: {
  itemId: string
  title: string
  userId: string
  onRecord: (status: Status, attempt: Attempt) => void
  onUndoRecord: () => void
  onClose: () => void
}) {
  const { bodies, loading } = useItemBodies([itemId], userId)
  const body = bodies[itemId]
  // 出題してよい肢だけを item にする（以降は item の有無で分岐する）。
  const item = isAskableItem(body) ? body : null

  const [answer, setAnswer] = useState<boolean | null>(null)
  const [confidence, setConfidence] = useState<Confidence | null>(null)
  const [committed, setCommitted] = useState<Committed | null>(null)
  const [copied, setCopied] = useState(false)

  const commit = (gaveUp: boolean) => {
    if (!item || item.truth === null || committed) return
    if (!gaveUp && (answer === null || confidence === null)) return
    const truth = item.truth
    const attempt = itemAttempt(gaveUp ? null : answer, confidence ?? undefined, gaveUp, truth)
    const correct = attempt.correct === true
    const status = statusFromAttempt(correct, attempt.confidence, gaveUp)
    setCommitted({ status, correct, gaveUp })
    onRecord(status, attempt)
  }

  const undo = () => {
    if (!committed) return
    onUndoRecord()
    setCommitted(null)
    setAnswer(null)
    setConfidence(null)
  }

  const copy = async () => {
    if (!item) return
    try {
      await navigator.clipboard.writeText(formatItemForClipboard(title, item))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // クリップボードが使えない環境では何もしない
    }
  }

  const choiceCls = (on: boolean) =>
    `flex-1 py-3 rounded-lg border text-lg font-bold transition ${
      on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-800 border-gray-300'
    } disabled:opacity-50`
  const confCls = (on: boolean) =>
    `flex-1 py-2 rounded-lg border text-sm transition ${
      on ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'
    } disabled:opacity-50`

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-4">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">{title}</h2>
          {item && (
            <button onClick={copy} className="flex items-center gap-1 text-xs text-gray-600 border rounded px-2 py-1">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'コピーしました' : 'テキストをコピー'}
            </button>
          )}
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">本文を読み込み中…</p>
        ) : !item ? (
          <p className="text-sm text-gray-600">
            この肢は出題できません（本文が未取得・取得失敗、または正誤・法改正の確認待ち）。
            {typeof navigator !== 'undefined' && !navigator.onLine && ' オンラインに戻ってから開き直してください。'}
          </p>
        ) : (
          <>
            <p className="whitespace-pre-wrap leading-relaxed text-gray-900">{item.statement}</p>

            <div className="flex gap-2">
              <button disabled={!!committed} onClick={() => setAnswer(true)} className={choiceCls(answer === true)}>○</button>
              <button disabled={!!committed} onClick={() => setAnswer(false)} className={choiceCls(answer === false)}>×</button>
            </div>
            <div className="flex gap-2">
              <button disabled={!!committed} onClick={() => setConfidence('sure')} className={confCls(confidence === 'sure')}>確信</button>
              <button disabled={!!committed} onClick={() => setConfidence('unsure')} className={confCls(confidence === 'unsure')}>迷い</button>
            </div>

            {!committed ? (
              <div className="flex gap-2">
                <button
                  onClick={() => commit(false)}
                  disabled={answer === null || confidence === null}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40"
                >
                  解答する
                </button>
                <button onClick={() => commit(true)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">
                  分からない
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${committed.correct ? 'text-green-700' : 'text-red-700'}`}>
                    {committed.gaveUp ? '分からない' : committed.correct ? '正解' : '不正解'}
                  </span>
                  <span className="text-sm text-gray-600">正解は {truthLabel(item.truth === true)}</span>
                  <span className={`ml-auto text-xs border rounded px-2 py-0.5 ${STATUS_BG[committed.status]}`}>
                    {committed.status} を記録
                  </span>
                  <button onClick={undo} className="text-xs text-gray-500 underline">修正</button>
                </div>
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
