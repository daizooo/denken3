// 図解解説の図（docs/design/doboku1-ichiji.md §6.5）。型（rule / flow / compare）はデータから描き、
// 断面図など固有の形だけ自由SVG（<img src="data:..."> で表示し、スクリプトを実行させない）。
import type { ExplainFigure } from '../../lib/doboku1/types'
import { svgDataUrl, svgProblems } from '../../lib/doboku1/explain'

const Title = ({ children }: { children: string }) => (
  <p className="text-xs font-bold text-gray-600 mb-2">{children}</p>
)

/** 数値・ルール図: 決まり（規定値）を大きく、引っかけの値を取り消し線で並べる。 */
function RuleFigure({ f }: { f: Extract<ExplainFigure, { type: 'rule' }> }) {
  return (
    <div>
      <Title>{f.title}</Title>
      <dl className="divide-y rounded border bg-white">
        {f.rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
            <dt className="text-sm text-gray-700 min-w-[7em]">{r.label}</dt>
            <dd className="text-base font-bold text-blue-800">{r.value}</dd>
            {r.trap && (
              <dd className="text-xs text-red-700">
                <span className="line-through">{r.trap}</span> は誤り
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  )
}

/** フロー図: 手順を縦に並べ、分岐（やり直し・不可など）を横に添える。 */
function FlowFigure({ f }: { f: Extract<ExplainFigure, { type: 'flow' }> }) {
  return (
    <div>
      <Title>{f.title}</Title>
      <ol className="space-y-1">
        {f.steps.map((s, i) => (
          <li key={i}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">{i + 1}</span>
              <span className="rounded border bg-white px-3 py-1.5 text-sm text-gray-900">{s}</span>
              {(f.branches ?? []).filter(b => b.from === i).map((b, j) => (
                <span key={j} className={`text-xs rounded px-2 py-1 border ${b.bad ? 'border-red-300 bg-red-50 text-red-800' : 'border-gray-300 bg-gray-50 text-gray-700'}`}>
                  {b.label} → {b.to}
                </span>
              ))}
            </div>
            {i < f.steps.length - 1 && <div aria-hidden className="ml-3 h-3 border-l-2 border-blue-300" />}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** 比較表: 工法・機械などの違いを行×列で。 */
function CompareFigure({ f }: { f: Extract<ExplainFigure, { type: 'compare' }> }) {
  return (
    <div>
      <Title>{f.title}</Title>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1 bg-gray-100" />
              {f.columns.map((c, i) => <th key={i} className="border px-2 py-1 bg-gray-100 text-left font-bold text-gray-700">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {f.rows.map((r, i) => (
              <tr key={i}>
                <th className="border px-2 py-1 text-left font-bold text-gray-800 whitespace-nowrap">{r.label}</th>
                {r.cells.map((c, j) => <td key={j} className="border px-2 py-1 text-gray-800">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** 自由SVG: 検証に通らないものは表示しない（保存時のゲートの二重化）。 */
function SvgFigure({ f }: { f: Extract<ExplainFigure, { type: 'svg' }> }) {
  const ok = svgProblems(f.svg).length === 0
  return (
    <div>
      <Title>{f.title}</Title>
      {ok
        ? <img src={svgDataUrl(f.svg)} alt={f.alt} className="mx-auto w-full max-w-md rounded border bg-white" />
        : <p className="text-xs text-gray-500">（図を表示できません：{f.alt}）</p>}
    </div>
  )
}

export default function ExplainFigureView({ figure }: { figure: ExplainFigure }) {
  switch (figure.type) {
    case 'rule': return <RuleFigure f={figure} />
    case 'flow': return <FlowFigure f={figure} />
    case 'compare': return <CompareFigure f={figure} />
    case 'svg': return <SvgFigure f={figure} />
  }
}
