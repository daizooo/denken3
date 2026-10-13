// 一括記録 — licensehub-expansion.md §6.3。
//
// 一括コピーした組（batchSession.ts）を復元し、番号だけの一覧で「正しい／正しい？／誤り？／誤り／分からない」を1タップで入力する。
//   - 送信前は、どの肢の正答・解説も描画しない（問題文は折りたたみで見られる）
//   - 送信できるのは、未記録の行がすべて入力済みのときだけ（batchGrade.ts canSubmitBatch）
//   - 送信すると行ごとに採点し、ItemSolver と同じ経路（onRecord = App の updateStatus）で記録する。
//     オフライン時は既存の送信待ちに入る
//   - 送信後の変更は行ごとの「修正」（取り消し）だけ。取り消した行は入力に戻り、送信し直せる
//   - 全行の記録が済んだら組に済みの印（gradedAt）を付ける（再読み込みで二重に記録しない）
// 組を復元できないときは、同じ組をもう一度作る手順を出す。
import { useState } from 'react'
import { X } from 'lucide-react'
import type { ReviewHistoryEntry, Status } from '../../domain/types'
import type { Attempt } from '../../lib/attempt'
import { isAskableItem, type ItemBody } from '../../lib/license/itemBody'
import { truthLabel } from '../../lib/license/itemText'
import {
  EMPTY_ROW, canSubmitBatch, findRecordIndex, gradeBatchRow, isRowFilled, type BatchRowInput,
} from '../../lib/license/batchGrade'
import { formatBatchCreatedAt } from '../../lib/license/batchText'
import { ITEM_CHOICES, type ItemChoice } from '../../lib/license/choices'
import {
  browserStorage, loadBatchSession, markBatchGraded, type BatchSession,
} from '../../lib/license/batchSession'
import { STATUS_BG } from '../shared/status'
import { useItemBodies } from './useItemBodies'

interface Recorded {
  status: 'A' | 'B' | 'C'
  correct: boolean
  /** 記録した実施日（取り消しで履歴を探すため）。 */
  date: string
}

export default function BatchGrade({
  userId, examId, titleOf, historyOf, onRecord, onDeleteEntry, onClose, onGoCopy,
}: {
  userId: string
  examId: string
  titleOf: (id: string) => string
  historyOf: (id: string) => ReviewHistoryEntry[]
  /** 記録する（App の updateStatus の経路）。記録した実施日を返す。 */
  onRecord: (id: string, status: Status, attempt: Attempt) => string
  /** 履歴の index 番目を取り消す（App の deleteEntry の経路）。 */
  onDeleteEntry: (id: string, index: number) => void
  onClose: () => void
  onGoCopy: () => void
}) {
  const [session, setSession] = useState<BatchSession | null>(
    () => loadBatchSession(browserStorage(), userId, examId),
  )
  const { bodies, loading } = useItemBodies(session?.ids ?? [], userId)
  const [inputs, setInputs] = useState<Record<string, BatchRowInput>>({})
  const [recorded, setRecorded] = useState<Record<string, Recorded>>({})

  const ids = session?.ids ?? []
  const askable = ids.filter(id => isAskableItem(bodies[id]))
  // 開いた時点で記録済みの組は、入力させない（二重記録を防ぐ）。解説だけ見られる。
  const gradedBefore = !!session?.gradedAt && Object.keys(recorded).length === 0
  const pending = gradedBefore ? [] : askable.filter(id => !recorded[id])
  const submittable = !loading && canSubmitBatch(pending, inputs)

  const setRow = (id: string, patch: Partial<BatchRowInput>) =>
    setInputs(prev => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_ROW), ...patch } }))

  const submit = () => {
    if (!session || !submittable) return
    const next: Record<string, Recorded> = { ...recorded }
    for (const id of pending) {
      const body = bodies[id]
      if (!isAskableItem(body) || body.truth === null) continue
      const r = gradeBatchRow(inputs[id], body.truth)
      if (!r) continue
      const date = onRecord(id, r.status, r.attempt)
      next[id] = { status: r.status, correct: r.correct, date }
    }
    setRecorded(next)
    if (askable.every(id => next[id])) {
      setSession(markBatchGraded(browserStorage(), session, new Date().toISOString()))
    }
  }

  const undo = (id: string) => {
    const rec = recorded[id]
    if (!rec || !session) return
    const i = findRecordIndex(historyOf(id), rec)
    if (i >= 0) onDeleteEntry(id, i)
    setRecorded(prev => { const n = { ...prev }; delete n[id]; return n })
    setInputs(prev => { const n = { ...prev }; delete n[id]; return n })
    if (session.gradedAt) setSession(markBatchGraded(browserStorage(), session, null))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-4">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">
            一括記録
            {session && <span className="ml-2 font-normal text-gray-500">作成 {formatBatchCreatedAt(session.createdAt)}・{ids.length}肢</span>}
          </h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>

        {!session ? (
          <RebuildSteps onGoCopy={onGoCopy} reason="保存された組が見つかりません（未作成・別の端末やブラウザで作成・端末の保存が無効）。" />
        ) : loading ? (
          <p className="text-sm text-gray-500">本文を読み込み中…</p>
        ) : askable.length === 0 ? (
          <RebuildSteps
            onGoCopy={onGoCopy}
            reason={`この組の肢を読み込めませんでした。${typeof navigator !== 'undefined' && !navigator.onLine ? 'オンラインに戻ってから開き直すか、' : ''}組を作り直してください。`}
          />
        ) : (
          <>
            {gradedBefore && (
              <p className="text-sm text-gray-700 rounded-lg bg-gray-50 border p-2">
                この組は記録済みです（{formatBatchCreatedAt(session.gradedAt ?? '')}）。新しい組は「一括コピー」から作ってください。
              </p>
            )}
            {askable.length < ids.length && (
              <p className="text-xs text-gray-500">
                {ids.length - askable.length} 肢は本文を取得できないか出題対象外になったため、記録しません。
              </p>
            )}
            <ol className="space-y-2">
              {ids.map((id, i) => {
                const body = bodies[id]
                if (!isAskableItem(body)) {
                  return (
                    <li key={id} className="text-xs text-gray-400 border rounded-lg px-3 py-2">
                      {i + 1}. 取得できません（記録しません）
                    </li>
                  )
                }
                const rec = recorded[id]
                return (
                  <BatchRow
                    key={id}
                    no={i + 1}
                    title={titleOf(id)}
                    body={body}
                    input={inputs[id] ?? EMPTY_ROW}
                    // 送信前は正答・解説を描画しない。描画するのは記録済みの行と、開いた時点で記録済みの組だけ。
                    reveal={rec ? { rec } : gradedBefore ? { rec: null } : null}
                    onChoose={c => setRow(id, { answer: c.answer, confidence: c.confidence, gaveUp: c.gaveUp })}
                    onUndo={() => undo(id)}
                  />
                )
              })}
            </ol>

            {pending.length > 0 && (
              <div className="space-y-1">
                <button
                  onClick={submit}
                  disabled={!submittable}
                  className="w-full py-2 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40"
                >
                  {Object.keys(recorded).length > 0 ? `残り ${pending.length} 肢を送信` : `${pending.length} 肢をまとめて送信`}
                </button>
                {!submittable && (
                  <p className="text-xs text-gray-500 text-center">
                    すべての行で答えを選ぶと送信できます（未入力 {pending.filter(id => !isRowFilled(inputs[id])).length} 肢）。
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function BatchRow({
  no, title, body, input, reveal, onChoose, onUndo,
}: {
  no: number
  title: string
  body: ItemBody
  input: BatchRowInput
  /** null の間は正答・解説を描画しない。rec が null なら記録済みの組の閲覧（修正なし）。 */
  reveal: { rec: Recorded | null } | null
  onChoose: (c: ItemChoice) => void
  onUndo: () => void
}) {
  const locked = reveal !== null
  const chosen = (c: ItemChoice) => c.gaveUp
    ? input.gaveUp === true
    : input.gaveUp !== true && input.answer === c.answer && input.confidence === c.confidence
  const btn = (c: ItemChoice) =>
    `px-2 py-1.5 rounded-lg border text-xs font-bold transition ${
      chosen(c) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-800 border-gray-300'
    } disabled:opacity-50`

  return (
    <li className="border rounded-lg px-3 py-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-8 text-lg font-bold text-gray-800">{no}.</span>
        {ITEM_CHOICES.map(c => (
          <button key={c.key} disabled={locked} onClick={() => onChoose(c)} className={btn(c)}>{c.label}</button>
        ))}
      </div>
      <details className="text-sm text-gray-700">
        <summary className="cursor-pointer text-xs text-gray-500">問題文{title ? `（${title}）` : ''}</summary>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{body.statement}</p>
      </details>
      {reveal && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {reveal.rec && (
              <span className={`font-bold ${reveal.rec.correct ? 'text-green-700' : 'text-red-700'}`}>
                {reveal.rec.correct ? '正解' : '不正解'}
              </span>
            )}
            <span className="text-sm text-gray-600">正解は {truthLabel(body.truth === true)}</span>
            {reveal.rec && (
              <>
                <span className={`ml-auto text-xs border rounded px-2 py-0.5 ${STATUS_BG[reveal.rec.status]}`}>
                  {reveal.rec.status} を記録
                </span>
                <button onClick={onUndo} className="text-xs text-gray-500 underline">修正</button>
              </>
            )}
          </div>
          <div className="rounded-lg bg-gray-50 border p-2">
            <p className="text-xs font-bold text-gray-500 mb-1">解説</p>
            <p className="whitespace-pre-wrap text-sm text-gray-800">{body.explanation?.trim() || '（解説なし）'}</p>
          </div>
        </div>
      )}
    </li>
  )
}

function RebuildSteps({ reason, onGoCopy }: { reason: string; onGoCopy: () => void }) {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <p>{reason}</p>
      <div className="rounded-lg bg-gray-50 border p-3">
        <p className="text-xs font-bold text-gray-500 mb-1">同じ組をもう一度作る手順</p>
        <ol className="list-decimal ml-5 space-y-1">
          <li>この画面を閉じ、復習タブで「一括コピー」を開く</li>
          <li>前回と同じ肢の数を選んで「テキストをコピー」を押す（今日の復習キューの先頭から同じ順に選ぶので、まだ記録していなければ同じ組になります）</li>
          <li>貼り付けたテキストが手元の問題と同じ順か確かめる</li>
          <li>「一括記録」を開き、手元の答えを番号どおりに入力して送信する</li>
        </ol>
      </div>
      <button onClick={onGoCopy} className="w-full py-2 rounded-lg border border-indigo-600 text-indigo-700 font-bold">
        一括コピーを開く
      </button>
    </div>
  )
}
