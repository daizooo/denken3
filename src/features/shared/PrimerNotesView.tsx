// 入門ノート一覧: 章（テーマ）を選ぶ → ノート（図解つき）→ その下に同じ章の問題が並び、タップで解く。
// 問題の解答画面にはノートを出さない（毎回出て邪魔になるため）。
import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { PrimerSection } from '../../data/kenkei2/primer/types'
import PrimerNoteView from '../kenkei2/PrimerNoteView'

export interface PrimerNotesTopic {
  id: string
  name: string
  sections: PrimerSection[]
  basis: string
  /** この章の問題（ID は入門の問題ID）。 */
  items: { id: string; title: string }[]
}

export default function PrimerNotesView({ heading, topics, onOpen, onClose }: {
  heading: string
  topics: PrimerNotesTopic[]
  /** 問題を解く（App の解答画面を開く）。 */
  onOpen: (itemId: string, title: string) => void
  onClose: () => void
}) {
  const [idx, setIdx] = useState<number | null>(null)
  const topic = idx === null ? null : topics[idx]

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-3xl sm:rounded-2xl">
        <div className="mb-3 flex items-center gap-2">
          {topic && (
            <button onClick={() => setIdx(null)} className="flex items-center text-xs text-blue-700"><ChevronLeft size={16} />一覧</button>
          )}
          <h2 className="flex-1 text-sm font-bold text-gray-700">{topic ? `${heading}：${topic.name}` : heading}</h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>

        {topic === null || idx === null ? (
          <ul className="space-y-2">
            {topics.map((t, i) => (
              <li key={t.id}>
                <button onClick={() => setIdx(i)}
                  className="flex w-full items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-left">
                  <span className="flex-1 text-sm font-bold text-gray-800">{i + 1}. {t.name}</span>
                  <span className="text-xs text-gray-500">問題 {t.items.length}問</span>
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-5">
            <PrimerNoteView key={topic.id} topic={topic} />
            <section className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
              <h3 className="text-sm font-bold text-blue-900">この章の問題（{topic.items.length}問）</h3>
              <ul className="space-y-1.5">
                {topic.items.map((q, i) => (
                  <li key={q.id}>
                    <button onClick={() => onOpen(q.id, `${heading} ${topic.name} 問${i + 1}　${q.title}`)}
                      className="flex w-full items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-sm text-gray-800">
                      <span className="w-8 shrink-0 text-xs text-gray-500">問{i + 1}</span>
                      <span className="flex-1">{q.title}</span>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <div className="flex justify-between text-xs">
              <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="rounded-lg border px-3 py-1.5 text-gray-700 disabled:opacity-30">← 前の章</button>
              <button disabled={idx === topics.length - 1} onClick={() => setIdx(idx + 1)} className="rounded-lg border px-3 py-1.5 text-gray-700 disabled:opacity-30">次の章 →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
