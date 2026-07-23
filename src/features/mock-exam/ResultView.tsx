import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { ArrowLeft, Check, X, ChevronDown, ChevronUp, Award, RotateCcw } from 'lucide-react'
import type { MockSession, PaperDefinition } from '../../domain/types'
import { scorePaper, transitionJudgment, type ScoreResult } from '../../lib/mock'
import PaperImage from './PaperImage'

// 採点・結果画面（§7.4(3)）。
// 総得点・A/B別・60点ラインとの差・所要時間、問題別○×、解説（採点後のみ）、
// 分野別集計、移行判定（60点×2回連続）、誤答→分野別復習前倒しを提供する。
export default function ResultView({
  userId, paper, session, sessions, passingScore = 60, onClose, onBoostReview,
}: {
  userId: string
  paper: PaperDefinition
  session: MockSession        // finished 済みセッション（score 確定）
  sessions: MockSession[]     // 同一ペーパーの履歴（移行判定・推移用）
  passingScore?: number
  onClose: () => void
  onBoostReview?: (sourceQuestionId: string) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  // 確定スコアがあればそれを、なければ現在の正答から採点する（再表示時のフォールバック）。
  const result: ScoreResult = useMemo(() => scorePaper(paper, session.answers), [paper, session.answers])
  const total = session.score ?? result.total
  const sec = session.score != null ? (session.section_scores ?? result.sectionScores) : result.sectionScores
  const diff = total - passingScore

  const elapsedSec = session.started_at && session.finished_at
    ? Math.max(0, Math.round((new Date(session.finished_at).getTime() - new Date(session.started_at).getTime()) / 1000))
    : null

  // 分野別集計（topic 単位の正答率）。
  const topicRows = useMemo(() => {
    const map = new Map<string, { earned: number; points: number }>()
    for (const r of result.perQuestion) {
      const t = r.question.topic
      if (!t) continue
      const e = map.get(t) ?? { earned: 0, points: 0 }
      e.earned += r.earned; e.points += r.points
      map.set(t, e)
    }
    return [...map.entries()]
      .map(([topic, v]) => ({ topic, ...v, rate: v.points ? Math.round((v.earned / v.points) * 100) : 0 }))
      .sort((a, b) => a.rate - b.rate)
  }, [result])

  // 移行判定＋スコア推移（cbt・finished を古い順に）。
  const judgment = useMemo(() => transitionJudgment(sessions, passingScore), [sessions, passingScore])
  const trend = useMemo(() => {
    return sessions
      .filter(s => s.status === 'finished' && s.mode === 'cbt' && s.score != null && s.finished_at)
      .sort((a, b) => (a.finished_at! < b.finished_at! ? -1 : 1))
      .map((s, i) => ({ n: `${i + 1}`, score: s.score as number }))
  }, [sessions])

  return (
    <div className="fixed inset-0 z-40 bg-gray-50 overflow-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-200"><ArrowLeft size={18} /></button>
          <p className="text-sm font-bold text-gray-800">{paper.name} 結果</p>
        </div>

        {/* 総得点カード */}
        <div className={`rounded-2xl border p-5 text-center ${
          total >= passingScore ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'
        }`}>
          <p className="text-xs text-gray-500">総得点</p>
          <p className={`text-4xl font-extrabold ${total >= passingScore ? 'text-emerald-600' : 'text-gray-800'}`}>
            {total}<span className="text-lg font-bold text-gray-400"> / 100</span>
          </p>
          <p className={`text-xs font-medium mt-1 ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            合格ライン{passingScore}点 {diff >= 0 ? `+${diff}` : diff}点
          </p>
          <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
            <span>A問題 <b className="text-gray-700">{sec.A}</b></span>
            <span>B問題 <b className="text-gray-700">{sec.B}</b></span>
            {elapsedSec != null && <span>所要 <b className="text-gray-700">{Math.floor(elapsedSec / 60)}分</b></span>}
          </div>
        </div>

        {/* 移行判定カード */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Award size={14} className="text-blue-500" />移行判定（{passingScore}点×2回連続）
          </h3>
          {judgment.met ? (
            <p className="text-sm font-bold text-emerald-600">達成：機械科目へ移行OK 🎉</p>
          ) : (
            <p className="text-xs text-gray-500">
              直近の連続合格 {judgment.streak} 回。あと {Math.max(0, 2 - judgment.streak)} 回の{passingScore}点以上で達成。
            </p>
          )}
          {trend.length >= 1 && (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="n" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <ReferenceLine y={passingScore} stroke="#10b981" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 分野別集計 */}
        {topicRows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">分野別正答率（弱い順）</h3>
            {topicRows.map(r => (
              <div key={r.topic} className="flex items-center gap-2 text-xs">
                <span className="w-24 truncate text-gray-600">{r.topic}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${r.rate < 50 ? 'bg-red-400' : r.rate < 80 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${r.rate}%` }} />
                </div>
                <span className="w-10 text-right text-gray-500">{r.rate}%</span>
              </div>
            ))}
          </div>
        )}

        {/* 問題別○× */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">問題別の結果</h3>
          <div className="divide-y divide-gray-100">
            {result.perQuestion.map(r => {
              const q = r.question
              const allOk = r.ok.every(Boolean)
              const open = openId === q.id
              return (
                <div key={q.id} className="py-2">
                  <button onClick={() => setOpenId(open ? null : q.id)} className="w-full flex items-center gap-2 text-left">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${allOk ? 'bg-emerald-500' : 'bg-red-400'}`}>
                      {allOk ? <Check size={14} /> : <X size={14} />}
                    </span>
                    <span className="text-sm font-medium text-gray-700">問{q.number}</span>
                    <span className="text-xs text-gray-400">{q.section}{q.selectable ? '・選択' : ''}</span>
                    <span className="flex-1" />
                    <span className="text-xs text-gray-500">{r.earned}/{r.points}点</span>
                    {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </button>

                  {open && (
                    <div className="mt-2 space-y-2 pl-8">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {q.parts.map((p, i) => (
                          <span key={i} className={r.ok[i] ? 'text-emerald-600' : 'text-red-500'}>
                            {p.label ?? '解答'}: あなた {r.got[i] || '—'} / 正答 {p.correct}
                          </span>
                        ))}
                      </div>
                      <PaperImage userId={userId} paperId={paper.id} filename={q.imageFile} />
                      {q.explanationFile && <PaperImage userId={userId} paperId={paper.id} filename={q.explanationFile} />}
                      {q.explanationUrl && (
                        <a href={q.explanationUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">解説ページ（電験王）</a>
                      )}
                      {!allOk && q.sourceQuestionId && onBoostReview && (
                        <button
                          onClick={() => onBoostReview(q.sourceQuestionId!)}
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100"
                        >
                          <RotateCcw size={12} /> 分野別のこの問題を今日の復習に前倒し
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
