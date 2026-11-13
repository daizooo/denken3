// 精算表（第5問）。試算表は印字済み。採点対象の欄（解答PDFの網掛け15マス）だけが入力欄で、整理記入などの計算は下のメモ欄で行う。
// 採点後は、正答と○×、「模範解答の精算表」（全欄）を出す。
import { useState } from 'react'
import type { CellResult } from '../../lib/kenkei2/grade'
import { settlementCellId, type SettlementCardKey, type SettlementCol, type SettlementFrame } from '../../lib/kenkei2/cards'

const COLS: SettlementCol[] = ['tb_d', 'tb_c', 'adj_d', 'adj_c', 'pl_d', 'pl_c', 'bs_d', 'bs_c']
const GROUPS: { name: string; cols: SettlementCol[] }[] = [
  { name: '残高試算表', cols: ['tb_d', 'tb_c'] },
  { name: '整理記入', cols: ['adj_d', 'adj_c'] },
  { name: '損益計算書', cols: ['pl_d', 'pl_c'] },
  { name: '貸借対照表', cols: ['bs_d', 'bs_c'] },
]
const fmt = (n: number) => (n === 0 ? '' : n.toLocaleString())

export default function SettlementForm({ frame, answerKey, values, onChange, results }: {
  frame: SettlementFrame
  answerKey: SettlementCardKey
  values: Record<string, string>
  onChange: (id: string, v: string) => void
  results: Map<string, CellResult> | null
}) {
  const [showKey, setShowKey] = useState(false)
  const scored = new Map(answerKey.scored.map(s => [settlementCellId(s.row, s.col), s]))
  const niCells = answerKey.scored.filter(s => s.row === 'ni')

  const cell = (row: number | 'ni', col: SettlementCol | 'label', wide = false) => {
    const id = settlementCellId(row, col)
    if (!scored.has(id)) return null
    const r = results?.get(id)
    if (!r) {
      return (
        <input data-kk2="1" value={values[id] ?? ''} onChange={e => onChange(id, e.target.value)}
          inputMode={col === 'label' ? 'text' : 'numeric'} aria-label={`解答欄 ${id}`}
          className={`rounded border border-blue-400 bg-blue-50 px-1 py-1 text-xs ${col === 'label' ? 'w-24 text-left' : 'w-full text-right'} ${wide ? 'w-28' : ''}`} />
      )
    }
    return (
      <span className={`block rounded border px-1 py-0.5 text-right text-xs ${r.ok ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'}`}>
        {r.given === null ? '—' : typeof r.given === 'number' ? r.given.toLocaleString() : r.given}
        {!r.ok && <span className="block text-[10px] font-bold">正: {typeof r.expected === 'number' ? r.expected.toLocaleString() : r.expected}</span>}
      </span>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">青い欄が採点対象です。整理記入の欄は採点しないので、計算はメモ欄で行ってください。</p>
      <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th rowSpan={2} className="border border-gray-300 px-2 py-1 text-left">勘定科目</th>
              {GROUPS.map(g => <th key={g.name} colSpan={2} className="border border-gray-300 px-2 py-1">{g.name}</th>)}
            </tr>
            <tr className="bg-gray-100">
              {COLS.map(c => <th key={c} className="border border-gray-300 px-2 py-0.5 font-normal">{c.endsWith('_d') ? '借方' : '貸方'}</th>)}
            </tr>
          </thead>
          <tbody>
            {frame.accounts.map((a, i) => (
              <tr key={i}>
                <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{a.n}</td>
                {COLS.map(c => (
                  <td key={c} className={`w-24 border border-gray-300 px-1 py-0.5 text-right tabular-nums ${c.startsWith('tb') ? '' : 'bg-gray-50'}`}>
                    {c === 'tb_d' ? fmt(a.tb[0]) : c === 'tb_c' ? fmt(a.tb[1]) : cell(i, c)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-gray-50">
              <td className="border border-gray-300 px-2 py-1 font-bold">当期純利益</td>
              {COLS.map(c => (
                <td key={c} className="border border-gray-300 px-1 py-0.5 text-right">
                  {c === 'pl_d' || c === 'pl_c' || c === 'bs_d' || c === 'bs_c' ? cell('ni', c) : null}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {niCells.some(s => s.col === 'label') && (
        <div className="flex items-center gap-2 text-xs text-gray-700">
          当期（<span className="font-bold">{cell('ni', 'label')}</span>）の見出し（純利益・純損失）
        </div>
      )}

      {results && (
        <div>
          <button onClick={() => setShowKey(v => !v)} className="text-xs text-blue-700 underline">
            {showKey ? '模範解答の精算表を閉じる' : '模範解答の精算表を見る'}
          </button>
          {showKey && (
            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-300 bg-white">
              <table className="w-full min-w-[760px] border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left">勘定科目</th>
                    {GROUPS.map(g => <th key={g.name} colSpan={2} className="border border-gray-300 px-2 py-1">{g.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {answerKey.accounts.map((a, i) => (
                    <tr key={i}>
                      <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{a.n}</td>
                      {[fmt(a.tb[0]), fmt(a.tb[1]), a.adj[0].map(x => x.toLocaleString()).join(' + '), a.adj[1].map(x => x.toLocaleString()).join(' + '),
                        fmt(a.pl[0]), fmt(a.pl[1]), fmt(a.bs[0]), fmt(a.bs[1])].map((v, j) => (
                        <td key={j} className="w-24 border border-gray-300 px-1 py-0.5 text-right tabular-nums">{v}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-2 py-1 font-bold">当期純利益</td>
                    <td colSpan={8} className="border border-gray-300 px-2 py-1 text-right tabular-nums">{answerKey.netIncome.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
