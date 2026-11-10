// 1級土木の一括記録（会社学習用。社労士の BatchGrade と同じ運用）。
// 一括コピーした組を復元し、番号ごとに「⑴〜⑷ ＋ 確信/迷い」または「分からない」を入力する。
//   - 送信前は正答・解説を描画しない（問題文は折りたたみで見られる）
//   - 未記録の行がすべて入力済みのときだけ送信できる（答えを見てから入力するのを防ぐ）
//   - 記録は演習画面と同じ経路（onRecord）。送信後の変更は行ごとの「修正」（取り消し）だけ
import { useState } from 'react'
import { X } from 'lucide-react'
import type { DbkQuestionRow } from '../../lib/doboku1/types'
import type { Attempt, Confidence } from '../../lib/attempt'
import { CHOICE_LABELS } from '../../lib/doboku1/explain'
import { choiceAttempt, statusOfAttempt } from '../../lib/doboku1/record'
import { browserStorage } from '../../lib/license/batchSession'
import { formatBatchCreatedAt } from '../../lib/license/batchText'
import { dbkTitle, formatDbkBody, loadDbkBatch, saveDbkBatch } from '../../lib/doboku1/copyText'
import { STATUS_BG } from '../shared/status'
import ExplainView from './ExplainView'

interface Row { choice: number | null; confidence: Confidence | null; gaveUp: boolean }
const EMPTY: Row = { choice: null, confidence: null, gaveUp: false }
const filled = (r: Row | undefined) => !!r && (r.gaveUp || (r.choice !== null && r.confidence !== null))

export default function Doboku1BatchGrade({ userId, byId, onRecord, onUndo, onClose, onGoCopy }: {
  userId: string
  byId: Map<string, DbkQuestionRow>
  onRecord: (id: string, a: Attempt) => void
  onUndo: (id: string) => void
  onClose: () => void
  onGoCopy: () => void
}) {
  const [session, setSession] = useState(() => loadDbkBatch(browserStorage(), userId))
  const ids = (session?.ids ?? []).filter(id => byId.has(id))
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [recorded, setRecorded] = useState<Record<string, Attempt>>({})
  const graded = !!session?.gradedAt
  const pending = ids.filter(id => !recorded[id])
  const canSubmit = !graded && pending.length > 0 && pending.every(id => filled(rows[id]))

  const setRow = (id: string, patch: Partial<Row>) => setRows(p => ({ ...p, [id]: { ...(p[id] ?? EMPTY), ...patch } }))
  const mark = (gradedAt: string | undefined) => {
    if (!session) return
    const { gradedAt: _g, ...rest } = session
    void _g
    const next = gradedAt ? { ...rest, gradedAt } : rest
    saveDbkBatch(browserStorage(), next)
    setSession(next)
  }

  const submit = () => {
    if (!canSubmit) return
    const add: Record<string, Attempt> = {}
    for (const id of pending) {
      const r = rows[id]!
      const a = choiceAttempt(r.gaveUp ? null : r.choice, r.confidence ?? undefined, byId.get(id)!.correct)
      onRecord(id, a)
      add[id] = a
    }
    setRecorded(p => ({ ...p, ...add }))
    mark(new Date().toISOString())
  }
  const fix = (id: string) => {
    onUndo(id)
    setRecorded(p => { const n = { ...p }; delete n[id]; return n })
    setRows(p => ({ ...p, [id]: EMPTY }))
    mark(undefined)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center">
      <div className="max-h-[92vh] w-full space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-xl sm:rounded-2xl">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">
            一括記録{session && <span className="ml-2 font-normal text-gray-500">（作成 {formatBatchCreatedAt(session.createdAt)}）</span>}
          </h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>

        {!session || ids.length === 0 ? (
          <div className="space-y-3 text-sm text-gray-600">
            <p>記録できる組がありません。先に「一括コピー」で問題をコピーしてください。</p>
            <button onClick={onGoCopy} className="w-full rounded-lg border border-blue-700 py-2 font-bold text-blue-800">一括コピーへ</button>
          </div>
        ) : graded && Object.keys(recorded).length === 0 ? (
          <div className="space-y-3 text-sm text-gray-600">
            <p>この組は記録済みです。新しく解くときは「一括コピー」で組を作り直してください。</p>
            <button onClick={onGoCopy} className="w-full rounded-lg border border-blue-700 py-2 font-bold text-blue-800">一括コピーへ</button>
          </div>
        ) : (
          <>
            <ol className="space-y-2">
              {ids.map((id, i) => {
                const q = byId.get(id)!
                const r = rows[id] ?? EMPTY
                const a = recorded[id]
                return (
                  <li key={id} className="space-y-2 rounded-lg border p-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-6 font-bold text-gray-700">{i + 1}.</span>
                      <span className="flex-1 truncate text-xs text-gray-500">{dbkTitle(q)}　{q.topic}</span>
                      {a && <span className={`rounded border px-1.5 text-xs ${STATUS_BG[statusOfAttempt(a)]}`}>{statusOfAttempt(a)}</span>}
                    </div>
                    <details className="text-xs text-gray-700">
                      <summary className="cursor-pointer text-gray-500">問題文</summary>
                      <p className="mt-1 whitespace-pre-wrap">{formatDbkBody(q).join('\n')}</p>
                    </details>
                    {!a ? (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-5 gap-1">
                          {CHOICE_LABELS.map((l, k) => (
                            <button key={l} onClick={() => setRow(id, { choice: k + 1, gaveUp: false })}
                              className={`rounded border py-1.5 text-sm ${r.choice === k + 1 && !r.gaveUp ? 'border-blue-700 bg-blue-700 text-white' : 'bg-white text-gray-800'}`}>{l}</button>
                          ))}
                          <button onClick={() => setRow(id, { gaveUp: !r.gaveUp })}
                            className={`rounded border py-1.5 text-[11px] ${r.gaveUp ? 'border-gray-700 bg-gray-700 text-white' : 'bg-white text-gray-600'}`}>分からない</button>
                        </div>
                        {!r.gaveUp && (
                          <div className="grid grid-cols-2 gap-1">
                            {(['sure', 'unsure'] as const).map(c => (
                              <button key={c} onClick={() => setRow(id, { confidence: c })}
                                className={`rounded border py-1 text-xs ${r.confidence === c ? 'border-blue-700 bg-blue-50 font-bold text-blue-800' : 'bg-white text-gray-600'}`}>
                                {c === 'sure' ? '確信' : '迷い'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`font-bold ${a.correct ? 'text-green-700' : 'text-red-700'}`}>
                            {a.gaveUp ? '分からない' : a.correct ? '正解' : `不正解（${CHOICE_LABELS[(a.selected?.[0] ?? 1) - 1]}）`}
                          </span>
                          <span className="text-gray-600">正答 {CHOICE_LABELS[q.correct - 1]}</span>
                          <button onClick={() => fix(id)} className="ml-auto text-xs text-gray-500 underline">修正</button>
                        </div>
                        <details>
                          <summary className="cursor-pointer text-xs text-gray-500">解説</summary>
                          <div className="mt-1">
                            <ExplainView explain={q.explain} verified={q.explain_verified} correctLabel={q.kind === 'statements' ? undefined : CHOICE_LABELS[q.correct - 1]} />
                          </div>
                        </details>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
            {pending.length > 0 && (
              <button onClick={submit} disabled={!canSubmit}
                className="w-full rounded-lg bg-blue-700 py-2 font-bold text-white disabled:opacity-40">
                採点して記録（{pending.length}問）
              </button>
            )}
            {pending.length > 0 && !canSubmit && <p className="text-xs text-gray-500">すべての番号を入力すると送信できます。</p>}
          </>
        )}
      </div>
    </div>
  )
}
