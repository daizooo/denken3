// 本番形式模試の一覧と受験・再開・結果（docs/design/kenkei2.md §7 K6）。
// - 回は kk2_questions に12枚そろっているものを選べる。受験中は再開、受験済みは結果を見直せる
// - セッションは denken_mock_sessions（exam_id='kenkei2'、subject_id='kk2'、paper_id=回、mode='cbt'。新しいテーブルは作らない）
// - 採点確定時に、誤答・未解答の問を理解度 C で記録して復習キューに入れる（App の updateStatus の経路）
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, RefreshCw, X } from 'lucide-react'
import type { Status } from '../../domain/types'
import type { Attempt } from '../../lib/attempt'
import { supabase } from '../../lib/supabase'
import type { Kk2Row } from '../../lib/kenkei2/cards'
import { KK2_MOCK, missedCards, scoreMock, type MockAnswers, type MockScore } from '../../lib/kenkei2/mock'
import Kenkei2MockResult from './Kenkei2MockResult'
import Kenkei2MockRunner from './Kenkei2MockRunner'

const TABLE = 'denken_mock_sessions'
const COLS = 'id, exam_no, part, sub, form_kind, points, stem, frame, key'

interface Session {
  id: string
  paper_id: string
  status: 'in_progress' | 'finished' | 'abandoned'
  started_at: string
  finished_at: string | null
  remaining_seconds: number | null
  answers: MockAnswers
  score: number | null
}

function toSession(r: Record<string, unknown>): Session {
  return {
    id: r.id as string, paper_id: r.paper_id as string, status: r.status as Session['status'],
    started_at: r.started_at as string, finished_at: (r.finished_at as string) ?? null,
    remaining_seconds: (r.remaining_seconds as number) ?? null,
    answers: (r.answers as MockAnswers) ?? {}, score: (r.score as number) ?? null,
  }
}

async function loadRows(userId: string, kai: number): Promise<Kk2Row[]> {
  const { data, error } = await supabase.from('kk2_questions').select(COLS).eq('user_id', userId).eq('exam_no', kai)
  if (error) throw error
  const rows = (data ?? []) as unknown as Kk2Row[]
  return rows.sort((a, b) => a.part - b.part || a.sub - b.sub)
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ja-JP') : '')

type Active =
  | { phase: 'running'; kai: number; session: Session; rows: Kk2Row[] }
  | { phase: 'result'; kai: number; rows: Kk2Row[]; answers: MockAnswers; score: MockScore; recorded?: number }

export default function Kenkei2MockView({ userId, onRecord, onClose }: {
  userId: string
  /** 誤答・未解答の問を復習キューに入れる（App の updateStatus）。無ければ記録しない。 */
  onRecord?: (itemId: string, status: Status, attempt: Attempt) => void
  onClose: () => void
}) {
  const [papers, setPapers] = useState<{ kai: number; count: number }[] | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState<Active | null>(null)

  const reloadSessions = useCallback(async () => {
    const { data, error: e } = await supabase.from(TABLE).select('*')
      .eq('user_id', userId).eq('exam_id', KK2_MOCK.examId).eq('subject_id', KK2_MOCK.subjectId)
      .order('started_at', { ascending: false })
    if (e) { setError(`受験記録を読めません: ${e.message}`); return }
    setSessions((data ?? []).map(toSession))
  }, [userId])

  useEffect(() => {
    let alive = true
    supabase.from('kk2_questions').select('exam_no').eq('user_id', userId)
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) { setError(`問題を読めません: ${e.message}`); return }
        const map = new Map<number, number>()
        for (const r of data ?? []) map.set(r.exam_no as number, (map.get(r.exam_no as number) ?? 0) + 1)
        setPapers([...map].map(([kai, count]) => ({ kai, count })).sort((a, b) => b.kai - a.kai))
      })
    void reloadSessions()
    return () => { alive = false }
  }, [userId, reloadSessions])

  const ready = useMemo(() => (papers ?? []).filter(p => p.count === KK2_MOCK.cardsPerPaper), [papers])

  const run = async (session: Session) => {
    setBusy(true); setError(null)
    try {
      const kai = Number(session.paper_id)
      setActive({ phase: 'running', kai, session, rows: await loadRows(userId, kai) })
    } catch (e) {
      setError(`問題を読めません: ${(e as Error).message ?? e}`)
    } finally { setBusy(false) }
  }

  const start = async (kai: number) => {
    if (sessions.some(s => s.status === 'in_progress' && s.paper_id === String(kai))) {
      setError('この回は受験中です。再開してください'); return
    }
    const { data, error: e } = await supabase.from(TABLE).insert({
      user_id: userId, exam_id: KK2_MOCK.examId, subject_id: KK2_MOCK.subjectId, paper_id: String(kai),
      mode: 'cbt', status: 'in_progress', remaining_seconds: KK2_MOCK.limitMin * 60, answers: {},
    }).select().single()
    if (e || !data) { setError(`開始できません: ${e?.message ?? ''}`); return }
    await run(toSession(data))
  }

  const autosave = useCallback(async (session: Session, answers: MockAnswers, remaining: number) => {
    await supabase.from(TABLE).update({ answers, remaining_seconds: remaining }).eq('id', session.id)
  }, [])

  const suspend = async (session: Session, answers: MockAnswers, remaining: number) => {
    await autosave(session, answers, remaining)
    setActive(null); void reloadSessions()
  }

  const finish = async (a: Extract<Active, { phase: 'running' }>, answers: MockAnswers, remaining: number) => {
    setBusy(true); setError(null)
    const score = scoreMock(a.rows, answers)
    const { error: e } = await supabase.from(TABLE).update({
      status: 'finished', finished_at: new Date().toISOString(), answers, remaining_seconds: remaining,
      score: score.total, section_scores: score.bySection,
    }).eq('id', a.session.id)
    if (e) { setError(`採点を保存できません: ${e.message}`); setBusy(false); return }
    // 誤答・未解答の問を復習に入れる（理解度 C）。受験直後の1回だけ
    const missed = missedCards(score)
    if (onRecord) for (const c of missed) onRecord(c.id, 'C', { correct: false })
    setActive({ phase: 'result', kai: a.kai, rows: a.rows, answers, score, recorded: onRecord ? missed.length : undefined })
    void reloadSessions()
    setBusy(false)
  }

  const abandon = async (s: Session) => {
    if (!window.confirm('この受験を中止します（記録は残りません）。よろしいですか？')) return
    await supabase.from(TABLE).update({ status: 'abandoned' }).eq('id', s.id)
    void reloadSessions()
  }

  const review = async (s: Session) => {
    setBusy(true); setError(null)
    try {
      const kai = Number(s.paper_id)
      const rows = await loadRows(userId, kai)
      setActive({ phase: 'result', kai, rows, answers: s.answers, score: scoreMock(rows, s.answers) })
    } catch (e) {
      setError(`問題を読めません: ${(e as Error).message ?? e}`)
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="max-h-[96vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-6xl sm:rounded-2xl">
        <div className="mb-3 flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">2級建設経理 本番形式模試</h2>
          {!active || active.phase === 'result' ? (
            <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
          ) : null}
        </div>

        {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>}

        {active?.phase === 'running' ? (
          <Kenkei2MockRunner
            key={active.session.id}
            kai={active.kai}
            rows={active.rows}
            initialAnswers={active.session.answers}
            initialRemaining={active.session.remaining_seconds ?? KK2_MOCK.limitMin * 60}
            onAutosave={(a, r) => { void autosave(active.session, a, r) }}
            onSuspend={(a, r) => { void suspend(active.session, a, r) }}
            onFinish={(a, r) => { void finish(active, a, r) }}
          />
        ) : active?.phase === 'result' ? (
          <Kenkei2MockResult kai={active.kai} rows={active.rows} answers={active.answers} score={active.score}
            recorded={active.recorded} onBack={() => setActive(null)} />
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              1回分（12問）を{KK2_MOCK.limitMin}分で通しで解きます。{KK2_MOCK.maxScore}点満点で、{KK2_MOCK.passScore}点以上が合格ライン
              （配点は資格スクール大栄の予想。合格基準・試験時間は公式で未確認）。採点は終了時だけです。誤答・未解答の問は復習に入ります。
            </p>
            {papers === null ? (
              <p className="text-sm text-gray-500">読み込み中…</p>
            ) : ready.length === 0 ? (
              <p className="text-sm text-gray-600">模試にできる回がありません（12問そろった回が必要です）。</p>
            ) : (
              <ul className="space-y-2">
                {ready.map(p => {
                  const mine = sessions.filter(s => s.paper_id === String(p.kai))
                  const inProgress = mine.find(s => s.status === 'in_progress')
                  const finished = mine.filter(s => s.status === 'finished')
                  return (
                    <li key={p.kai} className="rounded-xl border border-gray-200 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">第{p.kai}回</span>
                        {inProgress ? (
                          <>
                            <span className="text-xs text-amber-700">受験中（{fmtDate(inProgress.started_at)}〜）</span>
                            <button disabled={busy} onClick={() => void run(inProgress)}
                              className="ml-auto flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><RefreshCw size={14} /> 再開</button>
                            <button onClick={() => void abandon(inProgress)} className="text-xs text-gray-500 underline">中止</button>
                          </>
                        ) : (
                          <button disabled={busy} onClick={() => void start(p.kai)}
                            className="ml-auto flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Play size={14} /> {finished.length ? 'もう一度受験' : '受験する'}</button>
                        )}
                      </div>
                      {finished.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {finished.map(s => (
                            <li key={s.id} className="flex items-center gap-2 text-xs text-gray-600">
                              <span>{fmtDate(s.finished_at)}</span>
                              <span className="font-bold tabular-nums text-gray-800">{s.score ?? '-'} / {KK2_MOCK.maxScore} 点</span>
                              <span className={(s.score ?? 0) >= KK2_MOCK.passScore ? 'text-green-700' : 'text-red-700'}>
                                {(s.score ?? 0) >= KK2_MOCK.passScore ? '合格ライン到達' : '未達'}
                              </span>
                              <button disabled={busy} onClick={() => void review(s)} className="ml-auto text-blue-700 underline">結果を見る</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
