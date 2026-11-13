// 第3・4問の解答用紙。解答PDFのページの文字・罫線を座標どおりに写し、採点対象の欄だけを入力欄にする（docs/kenkei2-ingest.md）。
// 採点前は、採点対象外の途中の数値（frame.hide）を隠す。採点後に正答と○×を出す。
import type { CellResult } from '../../lib/kenkei2/grade'
import type { SheetFrame } from '../../lib/kenkei2/cards'

export default function SheetForm({ frame, values, onChange, results }: {
  frame: SheetFrame
  values: Record<string, string>
  onChange: (id: string, v: string) => void
  results: Map<string, CellResult> | null
}) {
  const [bx0, by0, bx1, by1] = frame.box
  const hidden = new Set(results ? [] : frame.hide ?? [])
  const pad = { x: 6, y: 4 }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <div className="relative" style={{ width: bx1 - bx0, height: by1 - by0 }}>
        {frame.rules.map((r, i) => (
          <div key={i} className="absolute bg-gray-700"
            style={{ left: r[0] - bx0, top: r[1] - by0, width: Math.max(1, r[2] - r[0]), height: Math.max(1, r[3] - r[1]) }} />
        ))}
        {frame.words.map(([t, x0, y0, , y1], i) => hidden.has(i) ? null : (
          <span key={i} className="absolute whitespace-nowrap text-gray-900"
            style={{ left: x0 - bx0, top: y0 - by0, fontSize: Math.max(9, (y1 - y0) * 0.92), lineHeight: 1 }}>{t}</span>
        ))}
        {frame.units.flatMap(u => u.cells.map((c, i) => {
          const id = `${u.id}.${i}`
          const [x0, y0, x1, y1] = c.box
          const w = Math.max(c.k === 's' ? 28 : 72, x1 - x0 + pad.x * 2)
          const style = { left: x0 - bx0 - pad.x, top: y0 - by0 - pad.y, width: w, height: y1 - y0 + pad.y * 2 }
          const r = results?.get(id)
          if (!r) {
            return (
              <input key={id} data-kk2="1" value={values[id] ?? ''} inputMode={c.k === 'a' ? 'numeric' : 'text'}
                onChange={e => onChange(id, e.target.value)} aria-label={`解答欄 ${id}`}
                maxLength={c.k === 's' ? 2 : undefined}
                className={`absolute rounded border border-blue-400 bg-blue-50 px-1 text-xs ${c.k === 'a' ? 'text-right' : 'text-center uppercase'}`}
                style={style} />
            )
          }
          const ok = r.ok
          return (
            <div key={id} className={`absolute rounded border px-1 text-xs ${ok ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'} ${c.k === 'a' ? 'text-right' : 'text-center'}`}
              style={{ ...style, lineHeight: `${style.height - 2}px` }}>
              {r.given === null ? '—' : typeof r.given === 'number' ? r.given.toLocaleString() : r.given}
              {!ok && (
                <span className="absolute left-0 whitespace-nowrap text-[10px] font-bold text-red-700" style={{ top: style.height }}>
                  正: {typeof r.expected === 'number' ? r.expected.toLocaleString() : r.expected}
                </span>
              )}
            </div>
          )
        }))}
      </div>
    </div>
  )
}
