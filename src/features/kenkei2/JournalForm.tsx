// 仕訳1組の入力（第1問）。借方・貸方とも複数行。科目は記号（A〜Y）で入れると科目名が出る（本番と同じく記号と科目を答える）。
import { parseSymbol } from '../../lib/kenkei2/normalize'
import type { JournalResult } from '../../lib/kenkei2/grade'
import type { JournalInput, JournalInputLine } from '../../lib/kenkei2/types'

type Side = 'debit' | 'credit'
const SIDE_LABEL: Record<Side, string> = { debit: '借方', credit: '貸方' }

export default function JournalForm({ symbols, value, onChange, result }: {
  symbols: [string, string][]
  value: JournalInput
  onChange: (next: JournalInput) => void
  result: JournalResult | null
}) {
  const names = new Map(symbols)
  const disabled = result !== null

  const setLine = (side: Side, i: number, patch: Partial<JournalInputLine>) =>
    onChange({ ...value, [side]: value[side].map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  const addLine = (side: Side) => onChange({ ...value, [side]: [...value[side], { symbol: '', amount: '' }] })
  const delLine = (side: Side, i: number) => onChange({ ...value, [side]: value[side].filter((_, j) => j !== i) })

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        {(['debit', 'credit'] as Side[]).map(side => (
          <div key={side} className="space-y-2">
            <div className="text-xs font-bold text-gray-600">{SIDE_LABEL[side]}</div>
            {value[side].map((l, i) => {
              const sym = parseSymbol(l.symbol)
              const name = sym ? names.get(sym) : undefined
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    data-kk2="1" disabled={disabled} value={l.symbol} maxLength={2} placeholder="記号"
                    onChange={e => setLine(side, i, { symbol: e.target.value })}
                    aria-label={`${SIDE_LABEL[side]} ${i + 1} 行目の記号`}
                    className="w-14 rounded border border-gray-300 px-1 py-1.5 text-center text-sm uppercase disabled:bg-gray-100"
                  />
                  <span className={`min-w-0 flex-1 truncate text-xs ${name ? 'text-gray-800' : 'text-gray-400'}`}>
                    {name ?? (l.symbol.trim() !== '' ? '科目群に無い記号' : '科目')}
                  </span>
                  <input
                    data-kk2="1" disabled={disabled} value={l.amount} inputMode="numeric" placeholder="金額"
                    onChange={e => setLine(side, i, { amount: e.target.value })}
                    aria-label={`${SIDE_LABEL[side]} ${i + 1} 行目の金額`}
                    className="w-32 rounded border border-gray-300 px-2 py-1.5 text-right text-sm disabled:bg-gray-100"
                  />
                  {!disabled && value[side].length > 1 && (
                    <button onClick={() => delLine(side, i)} aria-label="この行を削除" className="px-1 text-xs text-gray-400 hover:text-gray-600">×</button>
                  )}
                </div>
              )
            })}
            {!disabled && (
              <button onClick={() => addLine(side)} className="text-xs text-blue-700 underline">＋ 行を追加</button>
            )}
          </div>
        ))}
      </div>

      <details className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700" open>
        <summary className="cursor-pointer font-bold text-gray-600">勘定科目群</summary>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-4">
          {symbols.map(([s, n]) => <span key={s}><span className="font-bold">{s}</span> {n}</span>)}
        </div>
      </details>

      {result && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(['debit', 'credit'] as Side[]).map(side => (
            <div key={side} className="space-y-1 rounded-lg border border-gray-200 p-2">
              <div className="text-xs font-bold text-gray-600">{SIDE_LABEL[side]}の正答</div>
              {result[side].map(r => (
                <div key={r.symbol} className={`flex items-center gap-2 text-sm ${r.ok ? 'text-green-700' : 'text-red-700'}`}>
                  <span className="font-bold">{r.ok ? '○' : '×'}</span>
                  <span>{r.symbol} {names.get(r.symbol)}</span>
                  <span className="ml-auto tabular-nums">{r.expected.toLocaleString()}</span>
                  {!r.ok && <span className="text-xs text-gray-500">（入力 {r.given === 0 ? 'なし' : r.given.toLocaleString()}）</span>}
                </div>
              ))}
            </div>
          ))}
          {result.extra && <p className="text-xs text-red-700 sm:col-span-2">正答に無い科目、または記号が読み取れない行があります。</p>}
        </div>
      )}
    </div>
  )
}
