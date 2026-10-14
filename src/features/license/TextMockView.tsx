// 本番形式模試の一覧（licensehub-expansion.md §7・§8・PR-H）。年度×式の選択・受験・再開・結果と、温存の解放日の設定を束ねる。
// - 年度は lic_questions に揃っている（択一70問／選択式8科目）もので、温存の解放日を過ぎたものだけ選べる（isPaperAvailable）
// - セッションは denken_mock_sessions（exam_id='sharoushi'、subject_id=式、paper_id=年度、mode='cbt'）
// - 解放日は denken_settings.holdout_release_dates（migration 024）。未設定のグループは解放しない
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Lock, Play, RefreshCw, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { todayJST } from '../../lib/date'
import type { AnswerSpec, ItemLabel, LicFormat } from '../../domain/license'
import type { MockAnswer, TextMockSession } from '../../domain/types'
import type { ScoringSection } from '../../domain/scoring'
import { SHAROUSHI_SCORING } from '../../data/sharoushi/index.ts'
import {
  holdoutGroupLabel, isPaperAvailable, paperHoldoutGroups, parseReleaseDates,
} from '../../lib/license/holdout'
import { scoreTextPaper } from '../../lib/license/textMock'
import TextPaperRunner, { type RunnerQuestion } from './TextPaperRunner'
import TextMockResult from './TextMockResult'

const TABLE = 'denken_mock_sessions'
const EXAM_ID = 'sharoushi'
const FORMATS: LicFormat[] = ['taku', 'sentaku']

const sectionOf = (f: LicFormat): ScoringSection => SHAROUSHI_SCORING.sections.find(s => s.id === f)!
// 1回分に揃っているべき問の数（択一: 科目×問数＝70、選択式: 1科目1問＝8）。
const expectedCount = (f: LicFormat) => (f === 'taku' ? sectionOf(f).totalMax : sectionOf(f).subjects.length)

interface Paper { year: string; format: LicFormat; count: number; groups: (string | null)[] }

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
      .select('question_id, label, label_raw, statement')
      .eq('user_id', userId).in('question_id', ids.slice(i, i + 100))
    if (e) throw e
    for (const it of data ?? []) {
      (items[it.question_id as string] ??= []).push({
        label: it.label as ItemLabel, label_raw: (it.label_raw as string) ?? null, statement: (it.statement as string) ?? '',
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
  | { phase: 'result'; session: TextMockSession; questions?: RunnerQuestion[] }

export default function TextMockView({ userId, onClose }: { userId: string; onClose: () => void }) {
  const today = todayJST()
  const [papers, setPapers] = useState<Paper[] | null>(null)
  const [sessions, setSessions] = useState<TextMockSession[]>([])
  const [releaseDates, setReleaseDates] = useState<Record<string, string>>({})
  const [draftDates, setDraftDates] = useState<Record<string, string>>({})
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
    supabase.from('lic_questions').select('year, format, holdout_group').eq('user_id', userId)
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) { setError(`年度を読めません: ${e.message}`); return }
        const map = new Map<string, Paper>()
        for (const r of data ?? []) {
          const key = `${r.year}-${r.format}`
          const p = map.get(key) ?? { year: r.year as string, format: r.format as LicFormat, count: 0, groups: [] }
          p.count++
          p.groups.push((r.holdout_group as string) ?? null)
          map.set(key, p)
        }
        setPapers([...map.values()].sort((a, b) => b.year.localeCompare(a.year) || FORMATS.indexOf(a.format) - FORMATS.indexOf(b.format)))
      })
    supabase.from('denken_settings').select('holdout_release_dates').eq('user_id', userId).maybeSingle()
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) { setMsg('解放日の設定を読めません（migration 024 が未適用の可能性）。本物の年度は選べません'); return }
        const d = parseReleaseDates(data?.holdout_release_dates)
        setReleaseDates(d); setDraftDates(d)
      })
    void reloadSessions()
    return () => { alive = false }
  }, [userId, reloadSessions])

  const settings = useMemo(() => ({ releaseDates }), [releaseDates])
  const groups = useMemo(() => {
    const all = new Set<string>(['pilot-r7-rk'])
    for (const p of papers ?? []) for (const g of paperHoldoutGroups(p.year, p.groups)) all.add(g)
    return [...all].sort()
  }, [papers])

  const saveDates = async () => {
    const clean = parseReleaseDates(Object.fromEntries(Object.entries(draftDates).filter(([, v]) => v)))
    const { error: e } = await supabase.from('denken_settings')
      .upsert({ user_id: userId, holdout_release_dates: clean }, { onConflict: 'user_id' })
    if (e) { setMsg(`保存できません: ${e.message}`); return }
    setReleaseDates(clean); setDraftDates(clean); setMsg('解放日を保存しました')
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
    setActive({ phase: 'result', session: data ? toSession(data) : { ...session, ...row }, questions })
    void reloadSessions()
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
            <p className="text-xs text-gray-500">択一式 {sectionOf('taku').timeLimitMin}分・選択式 {sectionOf('sentaku').timeLimitMin}分。温存の年度は解放日を過ぎると選べます。</p>
            {papers.length === 0 && <p className="text-sm text-gray-600">取り込み済みの年度がありません。</p>}
            {papers.map(p => {
              const sec = sectionOf(p.format)
              const complete = p.count === expectedCount(p.format)
              const open = isPaperAvailable(p.year, p.groups, today, settings)
              const inProgress = sessions.find(s => s.status === 'in_progress' && s.paper_id === p.year && s.subject_id === p.format)
              const finished = sessions.filter(s => s.status === 'finished' && s.paper_id === p.year && s.subject_id === p.format)
              const best = finished.reduce<number | null>((m, s) => (s.score != null ? Math.max(m ?? 0, s.score) : m), null)
              return (
                <div key={`${p.year}-${p.format}`} className="flex flex-wrap items-center gap-2 border rounded-xl p-2 text-sm">
                  <span className="font-bold text-gray-700">{p.year} {sec.name}</span>
                  <span className="text-xs text-gray-500">
                    {p.count}/{expectedCount(p.format)}{finished.length > 0 ? `・受験${finished.length}回・最高${best ?? '-'}/${sec.totalMax}` : ''}
                  </span>
                  <span className="flex-1" />
                  {!complete ? <span className="text-xs text-gray-400">問が揃っていません</span>
                    : !open ? (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Lock size={14} /> 温存中（{paperHoldoutGroups(p.year, p.groups).map(g => releaseDates[g] ?? '解放日未設定').join('・')}）
                      </span>
                    ) : inProgress ? (
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
                onClick={() => setActive({ phase: 'result', session: s })}
                className="w-full text-left text-sm border rounded px-2 py-1 text-gray-700"
              >
                {(s.finished_at ?? s.started_at).slice(0, 10)}　{s.paper_id} {sectionOf(s.subject_id).name}　{s.score ?? '-'} / {sectionOf(s.subject_id).totalMax} 点
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <p className="text-xs text-gray-500">温存の解放日（未設定のグループは解放しません。§8）</p>
          {groups.map(g => (
            <label key={g} className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <span className="flex-1 min-w-48">{holdoutGroupLabel(g)}</span>
              <input
                type="date" value={draftDates[g] ?? ''}
                onChange={e => setDraftDates(prev => ({ ...prev, [g]: e.target.value }))}
                className="border rounded px-2 py-1"
              />
            </label>
          ))}
          <button onClick={() => void saveDates()} className="px-3 py-1 rounded border border-indigo-600 text-indigo-700 text-sm">解放日を保存</button>
          {msg && <p className="text-xs text-gray-500">{msg}</p>}
        </div>
      </div>
    </div>
  )
}
