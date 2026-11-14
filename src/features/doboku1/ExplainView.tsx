// 図解解説（1問分）: ①論点 → ②図 0〜2枚 → ③肢チェック（○/× と一言）→ 根拠。
// 初学者向けにシンプルに（docs/design/doboku1-ichiji.md §6.5）。根拠未確認（explain_verified=false）は表示で明示する。
import type { Explain } from '../../lib/doboku1/types'
import ExplainFigureView from './ExplainFigureView'

export default function ExplainView({ explain, verified, correctLabel, pickWrong }: {
  explain: Explain | null
  verified: boolean
  correctLabel?: string   // 例: '⑶'。正答肢の行を強調する
  pickWrong?: boolean      // 「適当でないもの」を選ぶ問（正答肢は × になる）
}) {
  if (!explain) {
    return <p className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-500">（解説は準備中です）</p>
  }
  return (
    <div className="space-y-3 rounded-lg border bg-gray-50 p-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold text-gray-500">解説</p>
        {!verified && (
          <span className="text-[11px] rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-800">AI作成・根拠確認中</span>
        )}
      </div>

      <p className="text-base font-bold leading-relaxed text-gray-900">{explain.point}</p>

      {explain.figures.map((f, i) => <ExplainFigureView key={i} figure={f} />)}

      <p className="text-xs text-gray-500">○＝正しい　×＝誤り{pickWrong && '（この問は誤りの肢 × が正答）'}</p>
      <ul className="divide-y rounded border bg-white">
        {explain.checks.map(c => (
          <li key={c.label} className={`flex items-start gap-2 px-3 py-2 ${c.label === correctLabel ? 'bg-blue-50' : ''}`}>
            <span className="w-6 shrink-0 font-bold text-gray-700">{c.label}</span>
            <span className={`w-5 shrink-0 font-bold ${c.ok ? 'text-green-700' : 'text-red-700'}`} aria-label={c.ok ? '適当' : '不適当'}>
              {c.ok ? '○' : '×'}
            </span>
            <span className="text-sm text-gray-800">{c.note}</span>
          </li>
        ))}
      </ul>

      {explain.basis && <p className="text-xs text-gray-500">根拠: {explain.basis}</p>}
    </div>
  )
}
