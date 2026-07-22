import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp } from 'lucide-react'
import type { Chapter, Review, Status } from '../../domain/types'

export default function DashboardView({
  data, chapters, reviews, totalQ, masteredQ
}: {
  data: { counts: Record<Status, number>; pieData: any[]; scheduleData: any[] }
  chapters: Chapter[]
  reviews: Record<string, Review>
  totalQ: number
  masteredQ: number
}) {
  const pct = totalQ > 0 ? Math.round((masteredQ / totalQ) * 100) : 0

  return (
    <div className="space-y-4">

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
