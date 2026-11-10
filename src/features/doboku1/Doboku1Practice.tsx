// 1級土木 第一次検定の演習画面（docs/design/doboku1-ichiji.md）。dbk_questions を読み、記録は
// denken_reviews（exam_id='doboku1'）。社労士の状態・集計とは独立に読み書きする（App の reviews には混ぜない）。
// 送信失敗・オフライン時は既存の送信待ち（offlineStore）に積み、App の flushOutbox が復帰時に送る。
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import type { DbkQuestionRow } from '../../lib/doboku1/types'
import type { Review } from '../../domain/types'
import type { Attempt } from '../../lib/attempt'
import { DOBOKU1_CATEGORIES } from '../../data/doboku1/categories'
import { DOBOKU1_EXAM_ID, recordAnswer, undoLast } from '../../lib/doboku1/record'
import { toDateStr, todayJST } from '../../lib/date'
import { queueWrite } from '../../lib/offlineStore'
import { STATUS_BG } from '../shared/status'
import Doboku1Solver from './Doboku1Solver'
import Doboku1BatchCopy from './Doboku1BatchCopy'
import Doboku1BatchGrade from './Doboku1BatchGrade'

const COLS = 'id, year, paper, q_no, group_label, required, category, topic, kind, direction, stem, statements, choice_header, choices, correct, has_figure, figure_path, explain, explain_verified'
const DUE = '__due'

export default function Doboku1Practice({ userId, switcher }: { userId: string; switcher: ReactNode }) {
  const [questions, setQuestions] = useState<DbkQuestionRow[]>([])
  const [reviews, setReviews] = useState<Record<string, Review>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>(DOBOKU1_CATEGORIES[0].id)
  const [queue, setQueue] = useState<string[] | null>(null)   // 解いている列（id）
  const [pos, setPos] = useState(0)
  const [batch, setBatch] = useState<'copy' | 'grade' | null>(null)   // 会社学習用（一括コピー・一括記録）
  const today = todayJST()

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('dbk_questions').select(COLS).eq('user_id', userId).order('year').order('paper').order('q_no'),
      supabase.from('denken_reviews').select('*').eq('user_id', userId).eq('exam_id', DOBOKU1_EXAM_ID),
    ]).then(([qs, rs]) => {
      if (!alive) return
      if (qs.error || rs.error) setError((qs.error ?? rs.error)!.message)
      setQuestions((qs.data ?? []) as DbkQuestionRow[])
      const map: Record<string, Review> = {}
      for (const r of rs.data ?? []) {
        map[r.question_id] = {
          ...r,
          review_history: Array.isArray(r.review_history) ? r.review_history : [],
          last_reviewed: r.last_reviewed ? toDateStr(r.last_reviewed) : null,
          first_reviewed: r.first_reviewed ? toDateStr(r.first_reviewed) : null,
          due_date: r.due_date ? toDateStr(r.due_date) : null,
        } as Review
      }
      setReviews(map)
      setLoading(false)
    })
    return () => { alive = false }
  }, [userId])

  const byId = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions])
  const isDue = (id: string) => { const d = reviews[id]?.due_date; return !!d && d <= today }
  const dueIds = questions.filter(q => isDue(q.id)).map(q => q.id)
  const list = category === DUE ? questions.filter(q => isDue(q.id)) : questions.filter(q => q.category === category)

  const save = async (r: Review) => {
    setReviews(prev => ({ ...prev, [r.question_id]: r }))
    const row = { user_id: userId, exam_id: DOBOKU1_EXAM_ID, ...r }
    const key = `${userId}:${DOBOKU1_EXAM_ID}:${r.question_id}`
    if (!navigator.onLine) { await queueWrite(key, row); return }
    const { error: e } = await supabase.from('denken_reviews').upsert(row)
    if (e) { console.error(e); await queueWrite(key, row) }
  }
  const record = (id: string, a: Attempt) => void save(recordAnswer(reviews[id], id, a, today))
  const undo = (id: string) => { const cur = reviews[id]; if (cur?.review_history.length) void save(undoLast(cur)) }

  const current = queue ? byId.get(queue[pos]) : undefined
  const next = () => {
    if (queue && pos + 1 < queue.length) setPos(pos + 1)
    else setQueue(null)
  }
  const start = (ids: string[], at = 0) => { if (ids.length) { setQueue(ids); setPos(at) } }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div className="flex items-center gap-2">
          {/* 資格の切り替え口は App と同じ ExamSwitcher（ここから社労士へ戻る）。 */}
          {switcher}
          <h2 className="font-bold text-gray-800">第一次検定</h2>
          {queue && <span className="text-xs text-gray-500">{pos + 1} / {queue.length}</span>}
          {queue && <button onClick={() => setQueue(null)} className="ml-auto text-xs text-gray-600 underline">一覧へ</button>}
        </div>

        {loading ? <p className="text-sm text-gray-500">読み込み中…</p>
          : error ? <p className="text-sm text-red-700">読み込めませんでした: {error}</p>
          : current ? (
            <div className="rounded-2xl border bg-white p-4">
              <Doboku1Solver key={current.id + pos} userId={userId} q={current} hasNext={!!queue && pos + 1 < queue.length}
                onRecord={a => record(current.id, a)} onUndo={() => undo(current.id)} onNext={next} />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setCategory(DUE)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${category === DUE ? 'border-blue-700 bg-blue-700 text-white' : 'bg-white text-gray-700'}`}>
                  復習 {dueIds.length}
                </button>
                {DOBOKU1_CATEGORIES.map(c => {
                  const n = questions.filter(q => q.category === c.id)
                  if (n.length === 0) return null
                  const doneN = n.filter(q => reviews[q.id]?.review_history.length).length
                  return (
                    <button key={c.id} onClick={() => setCategory(c.id)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${category === c.id ? 'border-blue-700 bg-blue-700 text-white' : 'bg-white text-gray-700'}`}>
                      {c.name} {doneN}/{n.length}
                    </button>
                  )
                })}
              </div>

              <button disabled={list.length === 0} onClick={() => start(list.map(q => q.id))}
                className="w-full rounded-lg bg-blue-700 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                {category === DUE ? '復習を始める' : 'この分野を順に解く'}（{list.length}問）
              </button>

              <div className="flex gap-2">
                <button onClick={() => setBatch('copy')} className="flex-1 rounded-lg border bg-white py-2 text-sm text-gray-700">一括コピー</button>
                <button onClick={() => setBatch('grade')} className="flex-1 rounded-lg border bg-white py-2 text-sm text-gray-700">一括記録</button>
              </div>

              <ul className="divide-y rounded-2xl border bg-white">
                {list.length === 0 && <li className="px-3 py-3 text-sm text-gray-500">該当する問題はありません。</li>}
                {list.map((q, i) => {
                  const r = reviews[q.id]
                  const st = r?.review_history.length ? r.status : null
                  return (
                    <li key={q.id}>
                      <button onClick={() => start(list.map(x => x.id), i)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50">
                        <span className="w-16 shrink-0 text-xs font-bold text-gray-500">{q.year} {q.paper}{String(q.q_no).padStart(2, '0')}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{q.topic}</span>
                        {q.explain && <span className="shrink-0 text-[10px] text-blue-700">図解</span>}
                        {st && <span className={`shrink-0 rounded border px-1.5 text-xs ${STATUS_BG[st]}`}>{st}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
      </div>
      {batch === 'copy' && (
        <Doboku1BatchCopy userId={userId} label={category === DUE ? '復習' : DOBOKU1_CATEGORIES.find(c => c.id === category)?.name ?? ''}
          list={list} onClose={() => setBatch(null)} onGoGrade={() => setBatch('grade')} />
      )}
      {batch === 'grade' && (
        <Doboku1BatchGrade userId={userId} byId={byId} onRecord={record} onUndo={undo}
          onClose={() => setBatch(null)} onGoCopy={() => setBatch('copy')} />
      )}
    </div>
  )
}
