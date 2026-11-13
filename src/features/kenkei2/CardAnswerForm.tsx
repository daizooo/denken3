// 1カードの問題文と解答欄（仕訳・金額・解答用紙・精算表）とメモ欄。演習（Kenkei2Solver）と模試（Kenkei2MockRunner）で共通。
// result があれば採点後の表示（読み取り専用の○×・正答）、無ければ入力中。
import { useMemo, useRef } from 'react'
import type { CardResult, Kk2Row } from '../../lib/kenkei2/cards'
import type { CellResult } from '../../lib/kenkei2/grade'
import type { CardDraft } from '../../lib/kenkei2/mock'
import JournalForm from './JournalForm'
import SettlementForm from './SettlementForm'
import SheetForm from './SheetForm'
import StemView from './StemView'

export default function CardAnswerForm({ row, draft, setDraft, result }: {
  row: Kk2Row
  draft: CardDraft
  setDraft: (f: (d: CardDraft) => CardDraft) => void
  result: CardResult | null
}) {
  const formRef = useRef<HTMLDivElement>(null)
  const cellMap = useMemo(() => {
    if (!result || result.kind !== 'cells') return null
    return new Map<string, CellResult>(result.cells.map(c => [c.id, c]))
  }, [result])
  const setAnswer = (id: string, v: string) => setDraft(d => ({ ...d, answers: { ...d.answers, [id]: v } }))
  const sheetLike = row.form_kind === 'sheet' || row.form_kind === 'settlement'

  // Enter で次の入力欄へ（PC で表を速く埋めるため。日本語入力の確定の Enter は除く）
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    const t = e.target as HTMLElement
    if (!(t instanceof HTMLInputElement) || !t.dataset.kk2) return
    const inputs = [...(formRef.current?.querySelectorAll<HTMLInputElement>('input[data-kk2]') ?? [])]
    const i = inputs.indexOf(t)
    if (i >= 0 && i + 1 < inputs.length) { e.preventDefault(); inputs[i + 1].focus() }
  }

  return (
    <div className="space-y-4">
      <StemView stem={row.stem} boxed={sheetLike} />

      <div ref={formRef} onKeyDown={onKeyDown} className="space-y-3">
        {row.form_kind === 'journal' && (
          <JournalForm symbols={row.frame.symbols} value={draft.journal}
            onChange={journal => setDraft(d => ({ ...d, journal }))}
            result={result?.kind === 'journal' ? result.journal : null} />
        )}
        {row.form_kind === 'amount' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">答え{row.frame.unit === '円' ? ' ¥' : ''}</span>
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
            readOnly={result !== null}
            className="mt-1 w-full rounded border border-gray-300 p-2 font-mono text-sm" />
        </label>
      </div>
    </div>
  )
}
