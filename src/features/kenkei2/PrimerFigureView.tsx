// 入門ノートの図解（src/data/kenkei2/primer/types.ts の PrimerFigure）を描く。宣言的なデータから HTML/CSS で描くので、
// 画面幅が狭いときは縦に並べ替わる（スマホ可）。
import type { DrawColor, DrawShape, FigBox, PrimerFigure } from '../../data/kenkei2/primer/types'

const box = 'rounded-lg border border-amber-300 bg-white px-3 py-2 text-center'

function Box({ b, tone = '' }: { b: FigBox; tone?: string }) {
  return (
    <div className={`${box} ${tone}`}>
      <div className="text-sm font-bold text-gray-900">{b.label}</div>
      {b.sub && <div className="mt-0.5 whitespace-pre-line text-[11px] leading-snug text-gray-600">{b.sub}</div>}
    </div>
  )
}

/** つなぎ。広い画面は横向き、狭い画面は縦向き。 */
function Link({ text }: { text?: string }) {
  const t = text ?? '→'
  const isArrow = t === '→'
  return (
    <div className="flex shrink-0 items-center justify-center text-amber-700" aria-hidden>
      <span className={isArrow ? 'text-lg sm:rotate-0 rotate-90' : 'text-base font-bold'}>{t}</span>
    </div>
  )
}

function Flow({ fig }: { fig: Extract<PrimerFigure, { kind: 'flow' }> }) {
  return (
    <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
      {fig.steps.map((s, i) => (
        <div key={i} className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center">
          <Box b={s} />
          {i < fig.steps.length - 1 && <Link text={s.next} />}
        </div>
      ))}
    </div>
  )
}

function Funnel({ fig }: { fig: Extract<PrimerFigure, { kind: 'funnel' }> }) {
  return (
    <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:justify-center">
      <div className="flex flex-col gap-1.5">{fig.sources.map((b, i) => <Box key={i} b={b} />)}</div>
      <Link />
      <Box b={fig.hub} tone="!border-2 !border-amber-500 !bg-amber-50" />
      {fig.outs && fig.outs.length > 0 && (
        <>
          <Link />
          <div className="flex flex-col gap-1.5">{fig.outs.map((b, i) => <Box key={i} b={b} />)}</div>
        </>
      )}
    </div>
  )
}

function Sides({ fig }: { fig: Extract<PrimerFigure, { kind: 'sides' }> }) {
  const side = (s: { title: string; items: string[] }, tone: string) => (
    <div className={`flex-1 rounded-lg border-2 px-3 py-2 ${tone}`}>
      <div className="mb-1 text-center text-sm font-bold text-gray-900">{s.title}</div>
      <ul className="space-y-0.5 text-xs text-gray-800">{s.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  )
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {side(fig.left, 'border-blue-300 bg-blue-50/60')}
      {side(fig.right, 'border-rose-300 bg-rose-50/60')}
    </div>
  )
}

function TAccounts({ fig }: { fig: Extract<PrimerFigure, { kind: 'taccount' }> }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {fig.accounts.map(a => (
        <div key={a.name} className="min-w-[10rem] flex-1 bg-white text-xs sm:max-w-[16rem]">
          <div className="border-b-2 border-gray-700 pb-0.5 text-center text-sm font-bold text-gray-900">{a.name}</div>
          <div className="grid grid-cols-2">
            <div className="min-h-[2.5rem] space-y-0.5 border-r-2 border-gray-700 py-1 pr-2 text-right text-gray-800">
              <div className="text-[10px] text-blue-700">借方（左）</div>
              {a.debit.map((t, i) => <div key={i}>{t}</div>)}
            </div>
            <div className="min-h-[2.5rem] space-y-0.5 py-1 pl-2 text-gray-800">
              <div className="text-[10px] text-rose-700">貸方（右）</div>
              {a.credit.map((t, i) => <div key={i}>{t}</div>)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Grid({ fig }: { fig: Extract<PrimerFigure, { kind: 'grid' }> }) {
  const hi = new Set((fig.hi ?? []).map(([r, c]) => `${r}:${c}`))
  const head = 'border border-amber-300 bg-amber-100 px-2 py-1 text-center font-bold text-gray-800'
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>{fig.groups.map(g => <th key={g.title} colSpan={g.cols.length} className={head}>{g.title}</th>)}</tr>
          <tr>{fig.groups.flatMap(g => g.cols.map((c, i) => <th key={`${g.title}${i}`} className={`${head} bg-amber-50 font-normal`}>{c}</th>))}</tr>
        </thead>
        <tbody>
          {fig.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`border border-amber-200 px-2 py-1 ${j === 0 ? 'font-bold' : 'text-right tabular-nums'} ${hi.has(`${i}:${j}`) ? 'bg-yellow-200 font-bold' : 'bg-white'} text-gray-800`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const COLOR: Record<DrawColor, string> = {
  soil: '#d6b98c', water: '#bfdbfe', concrete: '#d1d5db', steel: '#64748b',
  accent: '#d97706', warn: '#dc2626', gray: '#374151', white: '#ffffff', none: 'none',
}

function Shape({ sh }: { sh: DrawShape }) {
  if (sh.t === 'rect') return <rect x={sh.x} y={sh.y} width={sh.w} height={sh.h} fill={COLOR[sh.fill ?? 'none']} stroke={COLOR[sh.stroke ?? 'gray']} strokeWidth={1} strokeDasharray={sh.dash ? '4 3' : undefined} />
  if (sh.t === 'circle') return <circle cx={sh.cx} cy={sh.cy} r={sh.r} fill={COLOR[sh.fill ?? 'none']} stroke={COLOR[sh.stroke ?? 'gray']} strokeWidth={1} />
  if (sh.t === 'poly') return <polygon points={sh.points.map(p => p.join(',')).join(' ')} fill={COLOR[sh.fill ?? 'none']} stroke={COLOR[sh.stroke ?? 'gray']} strokeWidth={1} strokeDasharray={sh.dash ? '4 3' : undefined} />
  if (sh.t === 'line') {
    const c = COLOR[sh.stroke ?? 'gray']
    return <line x1={sh.x1} y1={sh.y1} x2={sh.x2} y2={sh.y2} stroke={c} strokeWidth={sh.width ?? 1.2} strokeDasharray={sh.dash ? '4 3' : undefined}
      markerEnd={sh.arrow || sh.both ? 'url(#pf-arrow)' : undefined} markerStart={sh.both ? 'url(#pf-arrow-start)' : undefined} />
  }
  return <text x={sh.x} y={sh.y} fontSize={sh.size ?? 11} textAnchor={sh.anchor ?? 'middle'} fontWeight={sh.bold ? 700 : 400} fill={COLOR[sh.color ?? 'gray']}>{sh.s}</text>
}

function Draw({ fig }: { fig: Extract<PrimerFigure, { kind: 'draw' }> }) {
  return (
    <svg viewBox={`0 0 ${fig.width} ${fig.height}`} className="mx-auto h-auto w-full max-w-2xl" role="img" aria-label={fig.caption ?? '図'}>
      <defs>
        <marker id="pf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#374151" /></marker>
        <marker id="pf-arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M10,0 L0,5 L10,10 z" fill="#374151" /></marker>
      </defs>
      <rect x="0" y="0" width={fig.width} height={fig.height} fill="white" />
      {fig.shapes.map((sh, i) => <Shape key={i} sh={sh} />)}
    </svg>
  )
}

export default function PrimerFigureView({ fig }: { fig: PrimerFigure }) {
  return (
    <figure className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
      {fig.kind === 'flow' ? <Flow fig={fig} />
        : fig.kind === 'funnel' ? <Funnel fig={fig} />
        : fig.kind === 'sides' ? <Sides fig={fig} />
        : fig.kind === 'taccount' ? <TAccounts fig={fig} />
        : fig.kind === 'draw' ? <Draw fig={fig} />
        : <Grid fig={fig} />}
      {fig.caption && <figcaption className="mt-2 text-center text-[11px] text-gray-600">{fig.caption}</figcaption>}
    </figure>
  )
}
