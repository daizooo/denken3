// 本番形式模試の解答画面（licensehub-expansion.md §7・PR-H）。電験の CBTRunner と同じ操作感で、テキストを1問ずつ解く。
// - 択一式: 本文＋肢（ア〜オ／A〜E）を表示し、A〜E から1つ選ぶ
// - 選択式: 1科目ずつ本文を表示し、空欄 A〜E ごとに語群から選ぶ（空欄ごとに語群が分かれる年度は、その語群だけ）
// - 制限時間（択一210分・選択式80分。ScoringSection.timeLimitMin）。0 で自動終了→採点。離席中（タブ非表示）は止める
// - 解答は変更時と30秒ごとに autosave（denken_mock_sessions。保存は呼び出し側）
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Flag, Grid3x3, PauseCircle } from 'lucide-react'
import type { AnswerSpec, ItemLabel } from '../../domain/license'
import { ITEM_LABELS } from '../../domain/license'
import type { MockAnswer, TextMockSession } from '../../domain/types'
import type { ScoringSection } from '../../domain/scoring'
import { blankChoices, isTextAnswered } from '../../lib/license/textMock'

export interface RunnerItem { label: ItemLabel; label_raw: string | null; statement: string }

export interface RunnerQuestion {
  id: string
  format: 'taku' | 'sentaku'
  scored_subject: string
  q_no: number | null
  stem: string | null
  answer_spec: AnswerSpec | null
  items: RunnerItem[]
}

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
const circled = (n: number) => (n >= 1 && n <= 20 ? CIRCLED[n - 1] : `(${n})`)

function formatClock(sec: number): string {
  const s = Math.max(0, sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export default function TextPaperRunner({
  section, year, questions, initial, onAutosave, onSuspend, onFinish,
}: {
  section: ScoringSection
  year: string
  questions: RunnerQuestion[]
  initial: TextMockSession
  onAutosave: (answers: Record<string, MockAnswer>, remaining: number) => void
  onSuspend: (answers: Record<string, MockAnswer>, remaining: number) => void
  onFinish: (answers: Record<string, MockAnswer>, remaining: number) => void
}) {
  const limitSec = section.timeLimitMin * 60
  const subjectName = Object.fromEntries(section.subjects.map(s => [s.code, s.name]))
  const [answers, setAnswers] = useState<Record<string, MockAnswer>>(() => ({ ...initial.answers }))
  const [idx, setIdx] = useState(0)
  const [showGrid, setShowGrid] = useState(false)
  const [showFinish, setShowFinish] = useState(false)
  const [clock, setClock] = useState<number>(initial.remaining_seconds ?? limitSec)

  const secondsRef = useRef<Record<string, number>>(
    Object.fromEntries(questions.map(q => [q.id, initial.answers[q.id]?.seconds ?? 0])),
  )
  const hiddenRef = useRef(false)
  const finishedRef = useRef(false)
  const q = questions[idx]

  // 解答状態＋表示秒数を1つの answers に畳む（保存用）。
  const folded = useCallback((base: Record<string, MockAnswer>) => {
    const out: Record<string, MockAnswer> = {}
    for (const pq of questions) {
      const a = base[pq.id]
      const sec = secondsRef.current[pq.id]
      if (a || sec) out[pq.id] = { selected: a?.selected ?? [], flagged: a?.flagged, seconds: sec || undefined }
    }
    return out
  }, [questions])

  const clockRef = useRef(clock); clockRef.current = clock
  const answersRef = useRef(answers); answersRef.current = answers
  const qIdRef = useRef(q?.id); qIdRef.current = q?.id

  const doFinish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinish(folded(answersRef.current), clockRef.current)
  }, [onFinish, folded])
  const doFinishRef = useRef(doFinish); doFinishRef.current = doFinish

  // 1秒ごと: 表示中の問の計測を進め、残り時間を減らす（0で自動終了）。
  useEffect(() => {
    const iv = setInterval(() => {
      if (hiddenRef.current || finishedRef.current) return
      const id = qIdRef.current
      if (id) secondsRef.current[id] = (secondsRef.current[id] ?? 0) + 1
      setClock(prev => {
        const next = prev - 1
        if (next <= 0) { queueMicrotask(() => doFinishRef.current()); return 0 }
        return next
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const onVis = () => { hiddenRef.current = document.hidden }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // 30秒ごとに残り時間を含めて autosave（解答は変更時に即 autosave）。
  const autosaveRef = useRef(onAutosave); autosaveRef.current = onAutosave
  useEffect(() => {
    const iv = setInterval(() => {
      if (!finishedRef.current) autosaveRef.current(folded(answersRef.current), clockRef.current)
    }, 30000)
    return () => clearInterval(iv)
  }, [folded])

  const update = useCallback((qid: string, f: (a: MockAnswer | undefined) => MockAnswer) => {
    setAnswers(prev => {
      const next = { ...prev, [qid]: f(prev[qid]) }
      queueMicrotask(() => autosaveRef.current(folded(next), clockRef.current))
      return next
    })
  }, [folded])

  const choose = (qid: string, n: number) => update(qid, a => ({ ...a, selected: [a?.selected[0] === n ? 0 : n] }))
  const chooseBlank = (qid: string, i: number, n: number) => update(qid, a => {
    const selected = ITEM_LABELS.map((_, k) => a?.selected[k] ?? 0)
    selected[i] = n
    return { ...a, selected }
  })
  const toggleFlag = (qid: string) => update(qid, a => ({ selected: a?.selected ?? [], flagged: !a?.flagged, seconds: a?.seconds }))

  if (!q) return <p className="p-4 text-sm text-gray-500">問題がありません。</p>

  const answeredCount = questions.filter(pq => isTextAnswered(answers[pq.id])).length
  const cur = answers[q.id]
  const title = q.format === 'taku'
    ? `${subjectName[q.scored_subject] ?? q.scored_subject}　問${q.q_no ?? ''}`
    : `${subjectName[q.scored_subject] ?? q.scored_subject}（選択式）`
  const spec = q.answer_spec
  const wordbank = spec?.kind === 'sentaku' ? spec.wordbank : {}

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* ヘッダー: 残り時間・解答数 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b text-sm">
        <span className="font-bold text-gray-700">{year} {section.name}</span>
        <span className={`font-mono ${clock < 600 ? 'text-red-600' : 'text-gray-700'}`}>残り {formatClock(clock)}</span>
        <span className="text-gray-500">{answeredCount}/{questions.length}</span>
        <span className="flex-1" />
        <button onClick={() => setShowGrid(v => !v)} aria-label="問題一覧" className="p-1 text-gray-600"><Grid3x3 size={18} /></button>
        <button onClick={() => onSuspend(folded(answers), clock)} aria-label="中断" className="p-1 text-gray-600"><PauseCircle size={18} /></button>
        <button onClick={() => setShowFinish(true)} className="px-2 py-1 rounded bg-indigo-600 text-white text-xs">終了</button>
      </div>

      {showGrid && (
        <div className="bg-white border-b p-2 grid grid-cols-10 gap-1 max-h-48 overflow-y-auto">
          {questions.map((pq, i) => (
            <button
              key={pq.id}
              onClick={() => { setIdx(i); setShowGrid(false) }}
              className={`text-xs py-1 rounded border ${i === idx ? 'ring-2 ring-indigo-500' : ''} ${isTextAnswered(answers[pq.id]) ? 'bg-indigo-100' : 'bg-white'} ${answers[pq.id]?.flagged ? 'border-amber-500' : ''}`}
            >
              {pq.format === 'taku' ? `${pq.scored_subject}${pq.q_no}` : pq.scored_subject}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">{title}</h2>
          <button
            onClick={() => toggleFlag(q.id)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${cur?.flagged ? 'bg-amber-100 border-amber-500 text-amber-700' : 'text-gray-500'}`}
          >
            <Flag size={14} /> 見直す
          </button>
        </div>
        {q.stem && <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{q.stem}</p>}

        {q.format === 'taku' && (
          <>
            <ul className="space-y-2">
              {q.items.map(it => (
                <li key={it.label} className="flex gap-2 text-sm leading-relaxed text-gray-800">
                  <span className="font-bold shrink-0">{it.label_raw ?? it.label}</span>
                  <span className="whitespace-pre-wrap">{it.statement}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-2">
              {ITEM_LABELS.map((l, i) => (
                <button
                  key={l}
                  onClick={() => choose(q.id, i + 1)}
                  className={`flex-1 py-3 rounded-xl border text-base font-bold ${cur?.selected[0] === i + 1 ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </>
        )}

        {q.format === 'sentaku' && (
          <div className="space-y-2">
            {ITEM_LABELS.map((l, i) => {
              const choices = blankChoices(spec, l)
              return (
                <label key={l} className="flex items-center gap-2 text-sm">
                  <span className="font-bold w-6">{l}</span>
                  <select
                    value={cur?.selected[i] ?? 0}
                    onChange={e => chooseBlank(q.id, i, Number(e.target.value))}
                    className="flex-1 border rounded px-2 py-2 bg-white"
                  >
                    <option value={0}>（未選択）</option>
                    {choices.map(n => <option key={n} value={n}>{circled(n)} {wordbank[String(n)] ?? ''}</option>)}
                  </select>
                </label>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 p-3 bg-white border-t">
        <button disabled={idx === 0} onClick={() => setIdx(i => i - 1)} className="flex items-center gap-1 px-3 py-2 rounded border text-sm disabled:opacity-40">
          <ChevronLeft size={16} /> 前
        </button>
        <span className="flex-1 text-center text-xs text-gray-500">{idx + 1} / {questions.length}</span>
        <button disabled={idx === questions.length - 1} onClick={() => setIdx(i => i + 1)} className="flex items-center gap-1 px-3 py-2 rounded border text-sm disabled:opacity-40">
          次 <ChevronRight size={16} />
        </button>
      </div>

      {showFinish && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 space-y-3 max-w-sm w-full">
            <p className="text-sm text-gray-700">
              解答 {answeredCount}/{questions.length}。終了して採点しますか？（残り {formatClock(clock)}）
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowFinish(false)} className="flex-1 py-2 rounded border text-sm">続ける</button>
              <button onClick={() => { setShowFinish(false); doFinish() }} className="flex-1 py-2 rounded bg-indigo-600 text-white text-sm">採点する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
