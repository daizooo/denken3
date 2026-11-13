// 入門ノート（前提知識）の本文。図解・表つき。問題の画面には出さず、「入門ノート」一覧（features/shared/PrimerNotesView）から読む。
import type { PrimerSection } from '../../data/kenkei2/primer/types'
import PrimerFigureView from './PrimerFigureView'

export default function PrimerNoteView({ topic }: {
  topic: { id: string; name: string; sections: PrimerSection[]; basis: string }
}) {
  return (
    <article className="space-y-5">
      {topic.sections.map(sec => (
        <section key={sec.heading} className="space-y-2">
          <h3 className="border-l-4 border-amber-400 pl-2 text-sm font-bold text-gray-900">{sec.heading}</h3>
          {sec.body.map((p, i) => <p key={i} className="text-sm leading-relaxed text-gray-800">{p}</p>)}
          {sec.figures?.map((f, i) => <PrimerFigureView key={i} fig={f} />)}
          {sec.table && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>{sec.table.columns.map(c => <th key={c} className="border border-amber-200 bg-amber-50 px-2 py-1 text-left font-bold text-gray-700">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {sec.table.rows.map((r, i) => (
                    <tr key={i}>{r.map((c, j) => <td key={j} className={`border border-amber-200 bg-white px-2 py-1 text-gray-800 ${j === 0 ? 'font-bold' : ''}`}>{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
      <p className="text-[11px] text-gray-500">Claude 作成・根拠未確認。根拠：{topic.basis}</p>
    </article>
  )
}
