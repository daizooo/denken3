// 本番形式模試の結果画面（licensehub-expansion.md §7・PR-H）。
// 科目別の得点・総得点・足切り科目の警告・判定（合格圏／ボーダー／不足）と、目標・合格基準までの差を出す。
// 得点は保存済みの section_scores（採点確定時の値）を正とし、判定は SHAROUSHI_THRESHOLDS 由来の ScoringSection で行う。
import { AlertTriangle, X } from 'lucide-react'
import { ITEM_LABELS } from '../../domain/license'
import type { ScoringSection } from '../../domain/scoring'
import type { TextMockSession } from '../../domain/types'
import { judgeText, scoreQuestion, takuCorrectLabel, VERDICT_LABELS, type TextVerdict } from '../../lib/license/textMock'
import type { RunnerQuestion } from './TextPaperRunner'

const VERDICT_STYLE: Record<TextVerdict, string> = {
  safe: 'bg-green-100 text-green-800 border-green-400',
  border: 'bg-amber-100 text-amber-800 border-amber-400',
  short: 'bg-red-100 text-red-800 border-red-400',
}

export default function TextMockResult({
  section, session, questions, onClose,
}: {
  section: ScoringSection
  session: TextMockSession
  /** 問ごとの正誤を出すときに渡す（無ければ科目別だけ）。 */
  questions?: RunnerQuestion[]
  onClose: () => void
}) {
  const scores = session.section_scores ?? {}
  const j = judgeText(section, scores)
  const total = j.judgement.total
  const failures = new Set(j.judgement.floorFailures)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-4">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">結果　{session.paper_id} {section.name}</h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>

        <div className={`rounded-xl border p-3 space-y-1 ${VERDICT_STYLE[j.verdict]}`}>
          <p className="text-lg font-bold">{VERDICT_LABELS[j.verdict]}　{total} / {section.totalMax} 点</p>
          <p className="text-sm">
            合格基準 {section.passTotal} 点{j.toPass > 0 ? `まで あと ${j.toPass} 点` : ' を満たす'}
            ／ 目標 {section.targetTotal} 点{j.toTarget > 0 ? `まで あと ${j.toTarget} 点` : ' を満たす'}
          </p>
          {failures.size > 0 && (
            <p className="text-sm font-bold flex items-center gap-1">
              <AlertTriangle size={16} /> 足切り {failures.size} 科目（{[...failures].join('・')}）。足切りがあると総得点に関わらず不足です
            </p>
          )}
          <p className="text-xs opacity-80">足切りは原則（各科目 {section.subjects[0]?.floor ?? '-'} 点）で判定し、救済は見込みません。</p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b">
              <th className="text-left py-1">科目</th><th className="text-right">得点</th><th className="text-right">足切り</th>
            </tr>
          </thead>
          <tbody>
            {section.subjects.map(s => {
              const pts = scores[s.code] ?? 0
              const ng = failures.has(s.code)
              return (
                <tr key={s.code} className={`border-b ${ng ? 'bg-red-50 text-red-700 font-bold' : 'text-gray-700'}`}>
                  <td className="py-1">{s.code}　{s.name}</td>
                  <td className="text-right">{pts} / {s.maxPoints}</td>
                  <td className="text-right">{ng ? `⚠ ${s.floor}点未満` : `${s.floor}点以上`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {questions && questions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500">問ごとの正誤（あなたの解答 → 正答）</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs">
              {questions.map(q => {
                const a = session.answers[q.id]
                const r = scoreQuestion(q, a)
                const ok = r.points === r.maxPoints
                const label = q.format === 'taku' ? `${q.scored_subject} 問${q.q_no}` : `${q.scored_subject} 選択式`
                const detail = q.format === 'taku'
                  ? `${ITEM_LABELS[(a?.selected[0] ?? 0) - 1] ?? '－'} → ${takuCorrectLabel(q.answer_spec)}`
                  : `${r.points}/${r.maxPoints}`
                return (
                  <span key={q.id} className={`px-2 py-1 rounded border ${ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                    {ok ? '○' : '×'} {label}　{detail}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
