// 2級建設業経理士を1カード解く（docs/design/kenkei2.md §4）。
//   1. 問題文を読み、画面の解答欄に入力する（紙は使わない。計算はメモ欄。下書きは自動保存）
//   2. 「自信あり／迷いあり」で採点 → ○×と正答、得点を出す。理解度（A/B/C）を記録する。誤りは「修正」で取り消す
import { useMemo, useRef, useState } from 'react'
import type { Attempt, Confidence } from '../../lib/attempt'
import { gradeCard, passRateOf, type CardResult, type Kk2Row } from '../../lib/kenkei2/cards'
import type { CellResult } from '../../lib/kenkei2/grade'
import { scoredAttempt, statusOfAttempt } from '../../lib/kenkei2/record'
import { STATUS_BG } from '../shared/status'
import JournalForm from './JournalForm'
import SettlementForm from './SettlementForm'
import SheetForm from './SheetForm'
import StemView from './StemView'
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
  const formRef = useRef<HTMLDivElement>(null)
  const passRate = passRateOf(row)

  const cellMap = useMemo(() => {
    if (!result || result.kind !== 'cells') return null
    return new Map<string, CellResult>(result.cells.map(c => [c.id, c]))
  }, [result])

  const setAnswer = (id: string, v: string) => setDraft(d => ({ ...d, answers: { ...d.answers, [id]: v } }))

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

  // Enter で次の入力欄へ（PC で表を速く埋めるため。日本語入力の確定の Enter は除く）
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    const t = e.target as HTMLElement
    if (!(t instanceof HTMLInputElement) || !t.dataset.kk2) return
    const inputs = [...(formRef.current?.querySelectorAll<HTMLInputElement>('input[data-kk2]') ?? [])]
    const i = inputs.indexOf(t)
    if (i >= 0 && i + 1 < inputs.length) { e.preventDefault(); inputs[i + 1].focus() }
  }

  const sheetLike = row.form_kind === 'sheet' || row.form_kind === 'settlement'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="font-bold text-gray-700">第{row.exam_no}回 第{row.part}問{row.part <= 2 ? `(${row.sub})` : ''}</span>
        <span>{row.points}点（配点は資格スクール大栄の予想）</span>
        {passRate < 1 && <span>得点率 {Math.round(passRate * 100)}% 以上で正解扱い</span>}
      </div>

      <StemView stem={row.stem} boxed={sheetLike} />

      <div ref={formRef} onKeyDown={onKeyDown} className="space-y-3">
        {row.form_kind === 'journal' && (
          <JournalForm symbols={row.frame.symbols} value={draft.journal}
            onChange={journal => setDraft(d => ({ ...d, journal }))}
            result={result?.kind === 'journal' ? result.journal : null} />
        )}
        {row.form_kind === 'amount' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">答え ¥</span>
            {!cellMap ? (
              <input data-kk2="1" value={draft.answers.v ?? ''} inputMode="numeric" aria-label="答え"
                onChange={e => setAnswer('v', e.target.value)}
                className="w-48 rounded border border-gray-300 px-2 py-1.5 text-right text-sm" />
            ) : (
              <span className={`rounded border px-2 py-1 text-sm ${cellMap.get('v')?.ok ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'}`}>
                {draft.answers.v?.trim() ? draft.answers.v : '—'}
                {!cellMap.get('v')?.ok && <span className="ml-2 text-xs font-bold">正答 {row.key.value.toLocaleString()} {row.frame.unit}</span>}
              </span>
            )}
            <span className="text-xs text-gray-500">{row.frame.unit}</span>
          </div>
        )}
        {row.form_kind === 'sheet' && (
          <SheetForm frame={row.frame} values={draft.answers} onChange={setAnswer} results={cellMap} />
        )}
        {row.form_kind === 'settlement' && (
          <SettlementForm frame={row.frame} answerKey={row.key} values={draft.answers} onChange={setAnswer} results={cellMap} />
        )}

        <label className="block">
          <span className="text-xs text-gray-500">メモ（計算用。採点には使いません。自動保存されます）</span>
          <textarea value={draft.memo} onChange={e => setDraft(d => ({ ...d, memo: e.target.value }))} rows={sheetLike ? 8 : 4}
            className="mt-1 w-full rounded border border-gray-300 p-2 font-mono text-sm" />
        </label>
      </div>

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
