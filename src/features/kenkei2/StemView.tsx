// 問題文の表示。第3〜5問の表は、列の区切りをタブで持っている（docs/kenkei2-ingest.md）→ 列に並べて見せる。
export default function StemView({ stem, boxed }: { stem: string; boxed?: boolean }) {
  const lines = stem.split('\n')
  return (
    <div className={`space-y-1 text-sm leading-relaxed text-gray-900 ${boxed ? 'rounded-lg border border-gray-200 bg-gray-50 p-3' : ''}`}>
      {lines.map((line, i) => {
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
