// 模試の誤答の復習（licensehub-expansion.md §8.1）。誤答した問（選択式は誤答した空欄）ごとに、
// 各肢の本文・正誤（○×）・解説・自分の解答・正答を出す。解説は肢IDが同じ出る順の肢から来る（§4.2）。
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ITEM_LABELS } from '../../domain/license'
import type { MockAnswer } from '../../domain/types'
import { blankChoices, scoreQuestion, takuCorrectLabel } from '../../lib/license/textMock'
import type { RunnerItem, RunnerQuestion } from './TextPaperRunner'

const truthMark = (t: boolean | null | undefined) => (t === true ? '○' : t === false ? '×' : '？')

function Explanation({ item }: { item: RunnerItem }) {
  const text = item.explanation?.trim()
  return (
    <p className={`whitespace-pre-wrap text-xs ${text ? 'text-gray-700' : 'text-gray-400'}`}>
      {text || '解説未取り込み（出る順の同じ肢を取り込むと表示されます）'}
    </p>
  )
}

export default function MockMissReview({
  questions, answers, subjectName,
}: {
  questions: RunnerQuestion[]
  answers: Record<string, MockAnswer>
  subjectName: Record<string, string>
}) {
  const missed = questions.filter(q => { const r = scoreQuestion(q, answers[q.id]); return r.points < r.maxPoints })
  const [open, setOpen] = useState<string | null>(null)
  if (missed.length === 0) return <p className="text-sm text-green-700">誤答はありません。</p>

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">誤答の復習（{missed.length} 問）。各肢の ○× と解説を確認してください。</p>
      {missed.map(q => {
        const a = answers[q.id]?.selected ?? []
        const isOpen = open === q.id
        const spec = q.answer_spec
        const head = q.format === 'taku'
          ? `${subjectName[q.scored_subject] ?? q.scored_subject} 問${q.q_no}　あなた ${ITEM_LABELS[(a[0] ?? 0) - 1] ?? '－'} → 正答 ${takuCorrectLabel(spec)}`
          : `${subjectName[q.scored_subject] ?? q.scored_subject}（選択式）`
        return (
          <div key={q.id} className="border rounded-xl">
            <button onClick={() => setOpen(isOpen ? null : q.id)} className="w-full flex items-center gap-1 p-2 text-left text-sm text-gray-700">
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {head}
            </button>
            {isOpen && (
              <div className="px-3 pb-3 space-y-2">
                {q.stem && <p className="whitespace-pre-wrap text-sm text-gray-800">{q.stem}</p>}
                {q.format === 'taku' && q.items.map(it => (
                  <div key={it.label} className="rounded border bg-gray-50 p-2 space-y-1">
                    <p className="text-sm text-gray-800">
                      <span className={`font-bold mr-1 ${it.truth === false ? 'text-red-700' : it.truth === true ? 'text-green-700' : 'text-gray-500'}`}>
                        {truthMark(it.truth)}
                      </span>
                      <span className="font-bold mr-1">{it.label_raw ?? it.label}</span>{it.statement}
                    </p>
                    <Explanation item={it} />
                  </div>
                ))}
                {q.format === 'sentaku' && spec?.kind === 'sentaku' && ITEM_LABELS.map((l, i) => {
                  const correct = spec.blanks[l]
                  const mine = a[i] ?? 0
                  if (correct == null || mine === correct) return null
                  const it = q.items.find(x => x.label === l)
                  const word = (n: number) => (n > 0 && blankChoices(spec, l).includes(n) ? spec.wordbank[String(n)] : '（未選択）')
                  return (
                    <div key={l} className="rounded border bg-gray-50 p-2 space-y-1 text-sm text-gray-800">
                      <p><span className="font-bold">{l}</span>　あなた {word(mine)} → 正答 <span className="font-bold text-green-700">{spec.wordbank[String(correct)]}</span></p>
                      {it && <p className="text-xs text-gray-600">{it.statement}</p>}
                      {it && <Explanation item={it} />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
