// 入門ノート（前提知識）の表示。入門ドリルの上に出す。未読なら開いた状態、「読んだ」で次からは畳む（端末に記録）。
import { useState } from 'react'
import type { PrimerTopic } from '../../data/kenkei2/primer/types'

const READ_KEY = 'kk2:primer:read'

function readSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[]) } catch { return new Set() }
}
function markRead(topicId: string): void {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...readSet(), topicId])) } catch { /* 記録できなくても表示は動く */ }
}

export default function PrimerNoteView({ topic }: { topic: PrimerTopic }) {
  const [open, setOpen] = useState(() => !readSet().has(topic.id))
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-bold text-amber-900">
        <span>入門ノート：{topic.name}</span>
        <span className="text-xs font-normal text-amber-700">{open ? '閉じる' : '開く'}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-amber-200 px-3 py-3">
          {topic.sections.map(sec => (
            <div key={sec.heading} className="space-y-1.5">
              <h3 className="text-sm font-bold text-gray-800">{sec.heading}</h3>
              {sec.body.map((p, i) => <p key={i} className="text-sm leading-relaxed text-gray-800">{p}</p>)}
              {sec.table && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>{sec.table.columns.map(c => <th key={c} className="border border-amber-200 bg-white px-2 py-1 text-left font-bold text-gray-700">{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {sec.table.rows.map((r, i) => (
                        <tr key={i}>{r.map((c, j) => <td key={j} className={`border border-amber-200 bg-white px-2 py-1 text-gray-800 ${j === 0 ? 'font-bold' : ''}`}>{c}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          <p className="text-[11px] text-gray-500">Claude 作成・根拠未確認。根拠：{topic.basis}</p>
          <button type="button" onClick={() => { markRead(topic.id); setOpen(false) }}
            className="w-full rounded-lg border border-amber-400 bg-white py-2 text-sm font-bold text-amber-900">
            読んだ → 下のドリルを解く
          </button>
        </div>
      )}
    </section>
  )
}
