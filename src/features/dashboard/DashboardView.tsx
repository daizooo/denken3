import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import { TrendingUp, CalendarClock, Gauge, AlertTriangle, Target } from 'lucide-react'
import type { Chapter, Review, Status } from '../../domain/types'
import type { PaceResult, PaceVerdict } from '../../lib/pace'
import type { ChapterWeakness, WeeklyLearningPoint } from '../../lib/analytics'
import { formatMD } from '../../lib/date'

const VERDICT_STYLE: Record<PaceVerdict, { label: (n: number) => string; cls: string }> = {
  done:    { label: () => '完走済み', cls: 'text-emerald-600' },
  ahead:   { label: n => `先行 ${n}日`, cls: 'text-emerald-600' },
  onTrack: { label: () => '順調', cls: 'text-blue-600' },
  behind:  { label: n => `遅延 ${n}日`, cls: 'text-red-500' },
  stalled: { label: () => '実績待ち', cls: 'text-gray-400' },
}

function PaceCard({ pace }: { pace: PaceResult }) {
  if (!pace.hasPlan) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1.5">
          <Gauge size={14} className="text-blue-500" />ペース分析
        </h3>
        <p className="text-xs text-gray-400">
          「設定」で試験日を登録すると、現在ペース・完走予測・今日の推奨ノルマが表示されます。
        </p>
      </div>
    )
  }

  const v = VERDICT_STYLE[pace.verdict]
  const loadData = pace.weeklyLoad.map(w => ({
    week: w.weekLabel, 既存: w.due, 新規予測: w.projectedNew,
  }))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Gauge size={14} className="text-blue-500" />ペース分析
        </h3>
        {pace.daysToExam !== null && pace.daysToExam >= 0 && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <CalendarClock size={13} className="text-gray-400" />
            試験まで <b className="text-gray-700">{pace.daysToExam}</b> 日
          </span>
        )}
      </div>

      {/* 主要指標 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{pace.currentPace.toFixed(1)}</p>
          <p className="text-[11px] text-gray-400">現在ペース 問/日</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{pace.requiredPace.toFixed(1)}</p>
          <p className="text-[11px] text-gray-400">必要ペース 問/日</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-blue-600">{pace.recommendedNorm}</p>
          <p className="text-[11px] text-gray-400">今日の推奨ノルマ</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-3">
        <span className="text-gray-500">
          未着手 <b className="text-gray-700">{pace.remainingQ}</b> / {pace.totalQ}問
          {pace.projectedFinishDate && (
            <> · 完走予測 <b className="text-gray-700">{formatMD(pace.projectedFinishDate)}</b></>
          )}
        </span>
        <span className={`font-semibold ${v.cls}`}>{v.label(pace.verdictDays)}</span>
      </div>

      {/* マイルストーン */}
      {pace.milestones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pace.milestones.map(m => (
            <span
              key={m.key}
              className={`text-[11px] px-2 py-1 rounded-lg border ${
                m.daysFromToday < 0
                  ? 'bg-gray-50 text-gray-300 border-gray-100 line-through'
                  : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
              title={`あと ${m.daysFromToday} 日`}
            >
              {m.label} {formatMD(m.date)}
            </span>
          ))}
        </div>
      )}

      {/* 週次の復習負荷予測 */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">週次の復習負荷予測</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={loadData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="既存" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="新規予測" stackId="a" fill="#93c5fd" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 軌道修正の提案 */}
      {pace.needsReplan && pace.replanOptions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
            <AlertTriangle size={13} />遅延が続いています — 計画の見直しを検討
          </p>
          <ul className="space-y-1.5">
            {pace.replanOptions.map(o => (
              <li key={o.key} className="text-[11px] text-amber-800">
                <span className="font-medium">・{o.title}</span>
                <span className="text-amber-600"> — {o.detail}</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-amber-500">どれを選ぶかはあなた次第。上は試算です。</p>
        </div>
      )}
    </div>
  )
}

function WeaknessRanking({ rows }: { rows: ChapterWeakness[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1.5">
          <Target size={14} className="text-red-500" />章別 弱点ランキング
        </h3>
        <p className="text-xs text-gray-400">着手済みの問題がまだありません。</p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
        <Target size={14} className="text-red-500" />章別 弱点ランキング
      </h3>
      <div className="space-y-2.5">
        {rows.map(r => (
          <div key={r.code}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="font-medium text-gray-700">{r.name}</span>
              <span className="text-gray-400">
                正答 {Math.round(r.correctRate * 100)}% · {r.attempted}/{r.total}問
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.round(r.score * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">{r.advice}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-300 mt-3">
        弱点スコア = 不正答率・取りこぼし率・重要度の加重。解答時間はデータ蓄積後（Phase 2）に加味します。
      </p>
    </div>
  )
}

function LearningCurve({ points }: { points: WeeklyLearningPoint[] }) {
  if (points.length === 0) return null
  const data = points.map(p => ({
    week: p.week,
    初見: p.freshRate !== null ? Math.round(p.freshRate * 100) : null,
    復習: p.reviewRate !== null ? Math.round(p.reviewRate * 100) : null,
  }))
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
        <TrendingUp size={14} className="text-emerald-500" />学習曲線（週次 正答率）
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="初見" stroke="#f59e0b" strokeWidth={2} connectNulls dot={{ r: 2 }} />
          <Line type="monotone" dataKey="復習" stroke="#10b981" strokeWidth={2} connectNulls dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-300 mt-1">
        平均解答時間の推移は計測データ蓄積後（Phase 2）に追加します。
      </p>
    </div>
  )
}

export default function DashboardView({
  data, chapters, reviews, totalQ, masteredQ, pace, weakness, learningCurve,
}: {
  data: { counts: Record<Status, number>; pieData: any[]; scheduleData: any[] }
  chapters: Chapter[]
  reviews: Record<string, Review>
  totalQ: number
  masteredQ: number
  pace: PaceResult
  weakness: ChapterWeakness[]
  learningCurve: WeeklyLearningPoint[]
}) {
  const pct = totalQ > 0 ? Math.round((masteredQ / totalQ) * 100) : 0

  return (
    <div className="space-y-4">

      {/* ペース分析（最上部） */}
      <PaceCard pace={pace} />

      {/* 概要カード */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'A（完全正答）', value: data.counts.A, color: 'text-green-600' },
          { label: 'B（方向性OK）', value: data.counts.B, color: 'text-blue-600' },
          { label: 'C（要学習）', value: data.counts.C, color: 'text-red-500' },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* チャート行 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-blue-500" />理解度分布
            </h3>
            <span className="text-2xl font-bold text-blue-600">{pct}%</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={data.pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">今後7日間の復習予定</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.scheduleData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="問題数" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 弱点ランキング */}
      <WeaknessRanking rows={weakness} />

      {/* 学習曲線 */}
      <LearningCurve points={learningCurve} />

      {/* 章別進捗 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">章別進捗</h3>
        <div className="space-y-2.5">
          {chapters.map(c => {
            const done = c.questions.filter(q =>
              ['A', 'B'].includes(reviews[q.id]?.status ?? '')
            ).length
            const pct = c.questions.length > 0 ? (done / c.questions.length) * 100 : 0
            const mastered = c.questions.filter(q => reviews[q.id]?.status === 'A').length

            return (
              <div key={c.code}>
                <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                  <span className="font-medium">{c.name}</span>
                  <span>{mastered}完答 / {done}習得中 / {c.questions.length}問</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
