// 問題文の表示。第3〜5問の表は、列の区切りをタブで持っている（docs/kenkei2-ingest.md）→ 列に並べて見せる。
// 用語の穴埋め（「に入れる」の行から <用語群> の前まで）は、タブで挟まれた番号を空欄の枠にして1行の文として見せる。
const BLANK = /(?:^|\t) ?(\d{1,2})(?=\t|$)/g

function BlankLine({ line }: { line: string }) {
  const parts: (string | { n: string })[] = []
  let last = 0
  for (const m of line.matchAll(BLANK)) {
    parts.push(line.slice(last, m.index), { n: m[1] })
    last = m.index + m[0].length
  }
  parts.push(line.slice(last))
  return (
    <p className="whitespace-pre-wrap">
      {parts.map((p, i) => typeof p === 'string'
        ? p.replace(/\t/g, '')
        : <span key={i} className="mx-0.5 inline-block min-w-[2em] rounded border border-gray-500 px-1 text-center text-xs font-bold">{p.n}</span>)}
    </p>
  )
}

export default function StemView({ stem, boxed }: { stem: string; boxed?: boolean }) {
  const lines = stem.split('\n')
  let inFill = false
  return (
    <div className={`space-y-1 text-sm leading-relaxed text-gray-900 ${boxed ? 'rounded-lg border border-gray-200 bg-gray-50 p-3' : ''}`}>
      {lines.map((raw, i) => {
        if (raw.startsWith('<用語群>')) inFill = false
        const isHead = raw.includes('に入れる')
        const line = isHead ? raw.replace(/[\t ]に入れる/, '［　］に入れる') : raw
        if (isHead) { inFill = true; return <p key={i} className="whitespace-pre-wrap">{line}</p> }
        if (inFill) return <BlankLine key={i} line={line} />
        if (!line.includes('\t')) return <p key={i} className="whitespace-pre-wrap">{line}</p>
        const cells = line.split('\t').filter(c => c.trim() !== '')
        return (
          <div key={i} className="flex flex-wrap gap-x-6 gap-y-0.5">
            {cells.map((c, j) => <span key={j} className="whitespace-pre-wrap">{c}</span>)}
          </div>
        )
      })}
    </div>
  )
}
