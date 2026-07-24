import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, Clock, RefreshCw, Trophy, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { MockAnswer, MockMode, MockSession, PaperDefinition } from '../../domain/types'
import { scorePaper, transitionJudgment } from '../../lib/mock'
import { formatMD, toDateStr } from '../../lib/date'
import CBTRunner from './CBTRunner'
import ResultView from './ResultView'

const TABLE = 'denken_mock_sessions'

// DB行 → MockSession。
function toSession(r: Record<string, unknown>): MockSession {
  return {
    id: r.id as string,
    exam_id: r.exam_id as string,
    subject_id: r.subject_id as string,
    paper_id: r.paper_id as string,
    mode: r.mode as MockMode,
    status: r.status as MockSession['status'],
    started_at: r.started_at as string,
    finished_at: (r.finished_at as string) ?? null,
    remaining_seconds: (r.remaining_seconds as number) ?? null,
    answers: (r.answers as Record<string, MockAnswer>) ?? {},
    score: (r.score as number) ?? null,
    section_scores: (r.section_scores as { A: number; B: number }) ?? null,
    memo: (r.memo as string) ?? '',
  }
}

// 年度別演習タブ（features/mock-exam）。CBT模試の一覧・受験・結果を束ねる（§7.4）。
export default function MockExamView({
  userId, examId, subjectId, papers, passingScore = 60, onBoostReview,
}: {
  userId: string
  examId: string
  subjectId: string
  papers: PaperDefinition[]
  passingScore?: number
  onBoostReview?: (sourceQuestionId: string) => void
}) {
  const [sessions, setSessions] = useState<MockSession[]>([])
  const [phase, setPhase] = useState<'list' | 'running' | 'result'>('list')
  const [active, setActive] = useState<{ paper: PaperDefinition; session: MockSession } | null>(null)

  // ---- セッション取得 ----
  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('exam_id', examId)
      .eq('subject_id', subjectId)
      .order('started_at', { ascending: false })
    if (error) { console.error(error); return }
    setSessions((data ?? []).map(toSession))
  }, [userId, examId, subjectId])

  useEffect(() => { reload() }, [reload])

  const paperById = useMemo(() => Object.fromEntries(papers.map(p => [p.id, p])), [papers])
  const ready = papers.filter(p => !p.draft)
  const drafts = papers.filter(p => p.draft)
  const inProgress = sessions.find(s => s.status === 'in_progress')
  const judgment = transitionJudgment(sessions, passingScore)

  // 各ペーパーの受験回数・ベスト・最終受験日。
  const statOf = (paperId: string) => {
    const finished = sessions.filter(s => s.paper_id === paperId && s.status === 'finished')
    const best = finished.reduce<number | null>((m, s) => s.score != null ? Math.max(m ?? 0, s.score) : m, null)
    const last = sessions.filter(s => s.paper_id === paperId).map(s => s.started_at).sort().at(-1)
    return { count: finished.length, best, last: last ? toDateStr(last) : null }
  }

  // ---- 新規受験開始 ----
  const start = async (paper: PaperDefinition, mode: MockMode) => {
    const { data, error } = await supabase.from(TABLE).insert({
      user_id: userId, exam_id: examId, subject_id: subjectId, paper_id: paper.id,
      mode, status: 'in_progress',
      remaining_seconds: mode === 'cbt' ? paper.timeLimitMin * 60 : null,
      answers: {},
    }).select().single()
    if (error || !data) { console.error(error); return }
    setActive({ paper, session: toSession(data) })
    setPhase('running')
  }

  const resume = (session: MockSession) => {
    const paper = paperById[session.paper_id]
    if (!paper) return
    setActive({ paper, session })
    setPhase('running')
  }

  // ---- autosave（解答・残り時間）----
  const autosave = useCallback(async (session: MockSession, answers: Record<string, MockAnswer>, remaining: number | null) => {
    await supabase.from(TABLE).update({ answers, remaining_seconds: remaining }).eq('id', session.id)
  }, [])

  // ---- 中断（残り時間を保存して一覧へ）----
  const suspend = async (session: MockSession, answers: Record<string, MockAnswer>, remaining: number | null) => {
    await supabase.from(TABLE).update({ answers, remaining_seconds: remaining }).eq('id', session.id)
    setPhase('list'); setActive(null); reload()
  }

  // ---- 採点確定 ----
  const finish = async (paper: PaperDefinition, session: MockSession, answers: Record<string, MockAnswer>, remaining: number | null) => {
    const scored = scorePaper(paper, answers)
    const finishedRow = {
      status: 'finished' as const,
      finished_at: new Date().toISOString(),
      remaining_seconds: remaining,
      answers,
      score: scored.total,
      section_scores: scored.sectionScores,
    }
    const { data, error } = await supabase.from(TABLE).update(finishedRow).eq('id', session.id).select().single()
    if (error) console.error(error)
    const finishedSession = data ? toSession(data) : { ...session, ...finishedRow }
    await reload()
    setActive({ paper, session: finishedSession })
    setPhase('result')
  }

  // ---- 描画 ----
  if (phase === 'running' && active) {
    return (
      <CBTRunner
        userId={userId}
        paper={active.paper}
        mode={active.session.mode}
        initial={active.session}
        onAutosave={(a, r) => autosave(active.session, a, r)}
        onSuspend={(a, r) => suspend(active.session, a, r)}
        onFinish={(a, r) => finish(active.paper, active.session, a, r)}
      />
    )
  }
  if (phase === 'result' && active) {
    return (
      <ResultView
        userId={userId}
        paper={active.paper}
        session={active.session}
        sessions={sessions}
        passingScore={passingScore}
        onClose={() => { setPhase('list'); setActive(null) }}
        onBoostReview={onBoostReview}
      />
    )
  }

  // 一覧
  return (
    <div className="space-y-3">
      {/* 移行判定サマリ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
        <Trophy size={20} className={judgment.met ? 'text-emerald-500' : 'text-gray-300'} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-700">移行判定（{passingScore}点×2回連続）</p>
          <p className="text-xs text-gray-500">
            {judgment.met
              ? '達成：機械科目へ移行OK'
              : `直近の連続合格 ${judgment.streak} 回 ／ あと ${Math.max(0, 2 - judgment.streak)} 回`}
          </p>
        </div>
      </div>

      {/* 再開カード */}
      {inProgress && paperById[inProgress.paper_id] && (
        <button
          onClick={() => resume(inProgress)}
          className="w-full text-left bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-blue-100/60"
        >
          <RefreshCw size={18} className="text-blue-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-700">受験を再開</p>
            <p className="text-xs text-blue-600/80">
              {paperById[inProgress.paper_id].name}（{inProgress.mode === 'cbt' ? 'CBT' : 'フリー'}）
              {inProgress.remaining_seconds != null && ` ・残 ${Math.floor(inProgress.remaining_seconds / 60)}分`}
            </p>
          </div>
          <Play size={18} className="text-blue-600" />
        </button>
      )}

      {/* 収録済みペーパー */}
      {ready.map(paper => {
        const s = statOf(paper.id)
        return (
          <div key={paper.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-gray-800">{paper.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  受験 {s.count} 回
                  {s.best != null && ` ・ベスト ${s.best}点`}
                  {s.last && ` ・最終 ${formatMD(s.last)}`}
                </p>
              </div>
              {s.best != null && s.best >= passingScore && (
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">合格</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => start(paper, 'cbt')}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
              >
                <Clock size={15} /> CBTモード（{paper.timeLimitMin}分）
              </button>
              <button
                onClick={() => start(paper, 'free')}
                className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                <Play size={15} /> フリー
              </button>
            </div>
          </div>
        )
      })}

      {/* 収録準備中（draft） */}
      {drafts.map(paper => (
        <div key={paper.id} className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-4 flex items-center gap-2">
          <FileText size={16} className="text-gray-300" />
          <p className="text-sm text-gray-400">{paper.name}</p>
          <span className="text-xs text-gray-400">収録準備中（正答・画像 未確定）</span>
        </div>
      ))}

      {ready.length === 0 && drafts.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-sm">この科目の年度別ペーパーはまだありません。</p>
        </div>
      )}
    </div>
  )
}
