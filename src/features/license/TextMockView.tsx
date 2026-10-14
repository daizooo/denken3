// 本番形式模試の一覧（licensehub-expansion.md §7・§8・PR-H）。年度×式の選択・受験・再開・結果と、温存の解放日の設定を束ねる。
// - 年度は lic_questions に揃っている（択一70問／選択式8科目）ものなら、いつでも選べる（電験の年度別と同じ）
// - どれをいつ解くかは決めず、最終期限（denken_settings.mock_deadline。migration 025）と未受験の年度×式だけを出す
// - セッションは denken_mock_sessions（exam_id='sharoushi'、subject_id=式、paper_id=年度、mode='cbt'）
// - 採点確定時に、誤答した問の肢を理解度 C で記録し、日々の復習キューに入れる（§8.1。記録は App の updateStatus の経路）
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, RefreshCw, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { todayJST } from '../../lib/date'
import type { AnswerSpec, ItemLabel, LicFormat } from '../../domain/license'
import type { MockAnswer, Status, TextMockSession } from '../../domain/types'
import type { Attempt } from '../../lib/attempt'
import type { ScoringSection } from '../../domain/scoring'
import { SHAROUSHI_MOCK_DEADLINE, SHAROUSHI_SCORING } from '../../data/sharoushi/index.ts'
import { isPaperReady, missedItemIds, mockProgress, scoreTextPaper } from '../../lib/license/textMock'
import TextPaperRunner, { type RunnerQuestion } from './TextPaperRunner'
import TextMockResult from './TextMockResult'

const TABLE = 'denken_mock_sessions'
const EXAM_ID = 'sharoushi'
const FORMATS: LicFormat[] = ['taku', 'sentaku']

const sectionOf = (f: LicFormat): ScoringSection => SHAROUSHI_SCORING.sections.find(s => s.id === f)!

interface Paper { year: string; format: LicFormat; count: number }

function toSession(r: Record<string, unknown>): TextMockSession {
  return {
    kind: 'text',
    id: r.id as string,
    exam_id: r.exam_id as string,
    subject_id: r.subject_id as TextMockSession['subject_id'],
    paper_id: r.paper_id as string,
    mode: 'cbt',
    status: r.status as TextMockSession['status'],
    started_at: r.started_at as string,
    finished_at: (r.finished_at as string) ?? null,
    remaining_seconds: (r.remaining_seconds as number) ?? null,
    answers: (r.answers as Record<string, MockAnswer>) ?? {},
    score: (r.score as number) ?? null,
    section_scores: (r.section_scores as Record<string, number>) ?? null,
    memo: (r.memo as string) ?? '',
  }
}

async function loadQuestions(userId: string, year: string, format: LicFormat): Promise<RunnerQuestion[]> {
  const { data: qs, error } = await supabase.from('lic_questions')
    .select('id, format, scored_subject, q_no, stem, answer_spec')
    .eq('user_id', userId).eq('year', year).eq('format', format)
  if (error) throw error
  const ids = (qs ?? []).map(q => q.id as string)
  const items: Record<string, RunnerQuestion['items']> = {}
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error: e } = await supabase.from('lic_items')
      .select('question_id, label, label_raw, statement, truth, explanation')
      .eq('user_id', userId).in('question_id', ids.slice(i, i + 100))
    if (e) throw e
    for (const it of data ?? []) {
      (items[it.question_id as string] ??= []).push({
        label: it.label as ItemLabel, label_raw: (it.label_raw as string) ?? null, statement: (it.statement as string) ?? '',
        truth: (it.truth as boolean | null) ?? null, explanation: (it.explanation as string | null) ?? null,
      })
    }
  }
  const order = sectionOf(format).subjects.map(s => s.code)
  return (qs ?? [])
    .map(q => ({
      id: q.id as string, format, scored_subject: q.scored_subject as string, q_no: (q.q_no as number) ?? null,
      stem: (q.stem as string) ?? null, answer_spec: (q.answer_spec as AnswerSpec) ?? null,
      items: (items[q.id as string] ?? []).sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => order.indexOf(a.scored_subject) - order.indexOf(b.scored_subject) || (a.q_no ?? 0) - (b.q_no ?? 0))
}

type Active =
  | { phase: 'running'; session: TextMockSession; questions: RunnerQuestion[] }
  | { phase: 'result'; session: TextMockSession; questions?: RunnerQuestion[]; recorded?: number }

export default function TextMockView({ userId, onRecord, onClose }: {
  userId: string
  /** 誤答した肢を復習キューに入れる（App の updateStatus）。無ければ記録しない。 */
  onRecord?: (itemId: string, status: Status, attempt: Attempt) => void
  onClose: () => void
}) {
  const today = todayJST()
  const [papers, setPapers] = useState<Paper[] | null>(null)
  const [sessions, setSessions] = useState<TextMockSession[]>([])
  const [deadline, setDeadline] = useState(SHAROUSHI_MOCK_DEADLINE)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState<Active | null>(null)

  const reloadSessions = useCallback(async () => {
    const { data, error: e } = await supabase.from(TABLE).select('*')
      .eq('user_id', userId).eq('exam_id', EXAM_ID).in('subject_id', FORMATS).eq('mode', 'cbt')
      .order('started_at', { ascending: false })
    if (e) { setError(`受験記録を読めません: ${e.message}`); return }
    setSessions((data ?? []).map(toSession))
  }, [userId])

  useEffect(() => {
    let alive = true
    supabase.from('lic_questions').select('year, format').eq('user_id', userId)
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) { setError(`年度を読めません: ${e.message}`); return }
        const map = new Map<string, Paper>()
        for (const r of data ?? []) {
          const key = `${r.year}-${r.format}`
          const p = map.get(key) ?? { year: r.year as string, format: r.format as LicFormat, count: 0 }
          p.count++
          map.set(key, p)
        }
        setPapers([...map.values()].sort((a, b) => b.year.localeCompare(a.year) || FORMATS.indexOf(a.format) - FORMATS.indexOf(b.format)))
      })
    supabase.from('denken_settings').select('mock_deadline').eq('user_id', userId).maybeSingle()
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) setMsg('最終期限の設定を読めません（migration 025 が未適用の可能性）。既定値で表示します')
        else if (data?.mock_deadline) setDeadline(data.mock_deadline as string)
      })
    void reloadSessions()
    return () => { alive = false }
  }, [userId, reloadSessions])

  const progress = useMemo(() => mockProgress(
    (papers ?? []).filter(p => isPaperReady(sectionOf(p.format), p.count)),
    sessions.filter(s => s.status === 'finished'), deadline, today,
  ), [papers, sessions, deadline, today])

  const saveDeadline = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) { setMsg('日付を YYYY-MM-DD で入れてください'); return }
    const { error: e } = await supabase.from('denken_settings')
      .upsert({ user_id: userId, mock_deadline: deadline }, { onConflict: 'user_id' })
    setMsg(e ? `保存できません: ${e.message}` : '最終期限を保存しました')
  }

  const run = async (session: TextMockSession) => {
    setBusy(true); setError(null)
    try {
      const questions = await loadQuestions(userId, session.paper_id, session.subject_id)
      setActive({ phase: 'running', session, questions })
    } catch (e) {
      setError(`問題を読めません: ${(e as Error).message ?? e}`)
    } finally { setBusy(false) }
  }

  const start = async (p: Paper) => {
    if (sessions.some(s => s.status === 'in_progress' && s.paper_id === p.year && s.subject_id === p.format)) {
      setError('この年度・式は受験中です。再開してください'); return
    }
    const { data, error: e } = await supabase.from(TABLE).insert({
      user_id: userId, exam_id: EXAM_ID, subject_id: p.format, paper_id: p.year, mode: 'cbt', status: 'in_progress',
      remaining_seconds: sectionOf(p.format).timeLimitMin * 60, answers: {},
    }).select().single()
    if (e || !data) { setError(`開始できません: ${e?.message ?? ''}`); return }
    await run(toSession(data))
  }

  const autosave = useCallback(async (session: TextMockSession, answers: Record<string, MockAnswer>, remaining: number) => {
    await supabase.from(TABLE).update({ answers, remaining_seconds: remaining }).eq('id', session.id)
  }, [])

  const suspend = async (session: TextMockSession, answers: Record<string, MockAnswer>, remaining: number) => {
    await autosave(session, answers, remaining)
    setActive(null); void reloadSessions()
  }

  const finish = async (session: TextMockSession, questions: RunnerQuestion[], answers: Record<string, MockAnswer>, remaining: number) => {
    const r = scoreTextPaper(sectionOf(session.subject_id), questions, answers)
    const row = {
      status: 'finished' as const, finished_at: new Date().toISOString(), remaining_seconds: remaining, answers,
      score: r.total, section_scores: r.subjectScores,
    }
    const { data, error: e } = await supabase.from(TABLE).update(row).eq('id', session.id).select().single()
    if (e) setError(`採点結果を保存できません（画面の結果は表示します）: ${e.message}`)
    // 誤答した問の肢を C で記録する（§8.1）。採点確定は1回だけなので、記録も1回だけ
    const missed = onRecord ? missedItemIds(questions, answers) : []
    for (const id of missed) onRecord?.(id, 'C', { correct: false })
    setActive({ phase: 'result', session: data ? toSession(data) : { ...session, ...row }, questions, recorded: missed.length })
    void reloadSessions()
  }

  // 過去の結果も、問を読み込んで誤答の復習を出す（読めなければ科目別だけ）
  const openResult = async (s: TextMockSession) => {
    setBusy(true)
    try {
      setActive({ phase: 'result', session: s, questions: await loadQuestions(userId, s.paper_id, s.subject_id) })
    } catch {
      setActive({ phase: 'result', session: s })
    } finally { setBusy(false) }
  }

  const abandon = async (session: TextMockSession) => {
    const { error: e } = await supabase.from(TABLE).update({ status: 'abandoned' }).eq('id', session.id)
    if (e) setError(`中止できません: ${e.message}`)
    void reloadSessions()
  }

  if (active?.phase === 'running') {
    const s = active.session
    return (
      <TextPaperRunner
        section={sectionOf(s.subject_id)} year={s.paper_id} questions={active.questions} initial={s}
        onAutosave={(a, rem) => { void autosave(s, a, rem) }}
        onSuspend={(a, rem) => { void suspend(s, a, rem) }}
        onFinish={(a, rem) => { void finish(s, active.questions, a, rem) }}
      />
    )
  }
  if (active?.phase === 'result') {
    return (
      <TextMockResult
        section={sectionOf(active.session.subject_id)} session={active.session} questions={active.questions}
        recorded={active.recorded}
        onClose={() => setActive(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-4">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">本番形式模試</h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {papers === null && !error && <p className="text-sm text-gray-500">読み込み中…</p>}

        {papers !== null && (
          <div className="space-y-2">
            <div className={`rounded-xl border p-2 text-sm space-y-1 ${progress.overdue ? 'bg-red-50 border-red-300 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
              <div className="flex flex-wrap items-center gap-2">
                最終期限
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="border rounded px-2 py-1 bg-white" />
                <button onClick={() => void saveDeadline()} className="px-2 py-1 rounded border border-indigo-600 text-indigo-700 text-xs">保存</button>
                <span className="text-xs">{progress.daysLeft >= 0 ? `残り ${progress.daysLeft} 日` : `${-progress.daysLeft} 日超過`}</span>
              </div>
              <p className="text-xs">
                {progress.remaining.length === 0
                  ? (progress.done.length > 0 ? 'すべて1回以上受験済み' : '本試験の年度がまだありません')
                  : `未受験 ${progress.remaining.length}: ${progress.remaining.map(p => `${p.year} ${sectionOf(p.format).name}`).join('・')}`}
              </p>
              {msg && <p className="text-xs text-gray-500">{msg}</p>}
            </div>
            <p className="text-xs text-gray-500">択一式 {sectionOf('taku').timeLimitMin}分・選択式 {sectionOf('sentaku').timeLimitMin}分。どの年度をいつ解くかは進捗を見て選んでください。</p>
            {papers.length === 0 && <p className="text-sm text-gray-600">取り込み済みの年度がありません。</p>}
            {papers.map(p => {
              const sec = sectionOf(p.format)
              const complete = isPaperReady(sec, p.count)
              const inProgress = sessions.find(s => s.status === 'in_progress' && s.paper_id === p.year && s.subject_id === p.format)
              const finished = sessions.filter(s => s.status === 'finished' && s.paper_id === p.year && s.subject_id === p.format)
              const best = finished.reduce<number | null>((m, s) => (s.score != null ? Math.max(m ?? 0, s.score) : m), null)
              return (
                <div key={`${p.year}-${p.format}`} className="flex flex-wrap items-center gap-2 border rounded-xl p-2 text-sm">
                  <span className="font-bold text-gray-700">{p.year} {sec.name}</span>
                  <span className="text-xs text-gray-500">
                    {p.count}問{finished.length > 0 ? `・受験${finished.length}回・最高${best ?? '-'}/${sec.totalMax}` : ''}
                  </span>
                  <span className="flex-1" />
                  {!complete ? <span className="text-xs text-gray-400">問が揃っていません</span>
                    : inProgress ? (
                      <>
                        <button disabled={busy} onClick={() => void run(inProgress)} className="flex items-center gap-1 px-3 py-1 rounded bg-indigo-600 text-white text-xs">
                          <RefreshCw size={14} /> 再開
                        </button>
                        <button onClick={() => void abandon(inProgress)} className="px-2 py-1 rounded border text-xs text-gray-600">中止</button>
                      </>
                    ) : (
                      <button disabled={busy} onClick={() => void start(p)} className="flex items-center gap-1 px-3 py-1 rounded bg-indigo-600 text-white text-xs">
                        <Play size={14} /> 開始
                      </button>
                    )}
                </div>
              )
            })}
          </div>
        )}

        {sessions.some(s => s.status === 'finished') && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500">受験記録</p>
            {sessions.filter(s => s.status === 'finished').map(s => (
              <button
                key={s.id}
                onClick={() => void openResult(s)}
                className="w-full text-left text-sm border rounded px-2 py-1 text-gray-700"
              >
                {(s.finished_at ?? s.started_at).slice(0, 10)}　{s.paper_id} {sectionOf(s.subject_id).name}　{s.score ?? '-'} / {sectionOf(s.subject_id).totalMax} 点
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
