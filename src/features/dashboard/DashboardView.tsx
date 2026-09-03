import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts'
import { TrendingUp, Gauge, AlertTriangle, Timer, Trophy } from 'lucide-react'
import type { Chapter, Review, Status } from '../../domain/types'
import type { PaceResult, PaceVerdict } from '../../lib/pace'
import type { PassTarget } from '../../lib/passTarget'
import type { Feasibility } from '../../lib/policy'
import type { ChapterWeakness, WeeklyLearningPoint, QuadrantItem, QuadrantMatrix, ScoreEstimate } from '../../lib/analytics'
import { buildChapterPriority } from '../../lib/chapterPriority'
import { STATUS_COLOR } from '../shared/status'
import { formatDuration } from '../../lib/timer'
import { formatMD } from '../../lib/date'
import { formatMinutes } from '../../lib/estimateMinutes'
import ChapterPriorityTable from './ChapterPriorityTable'

// 実現可能性バナー（adaptive-fsrs-policy.md §3.6・Phase B-4）。
//
// コアだけでも供給（使える時間）が必要量に届かないとき、**黙って目標を下げてはならない**。
// 事実を突きつけ、選ぶのは利用者に委ねる（アプリは自動では何も下げない）。
// safe / tight のときは出さない ―― 常時出る警告は読み飛ばされ、本当に足りない日に効かなくなる。
function FeasibilityBanner({ f }: { f: Feasibility }) {
  if (f.verdict !== 'shortfall') return null
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
      <h3 className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
        <AlertTriangle size={14} />時間が足りません
      </h3>
      <p className="text-xs text-red-800 leading-relaxed">
        全範囲を完走するには <strong>{formatMinutes(f.requiredMinutesPerDay)}/日</strong> 必要ですが、
        直近の実績は <strong>{formatMinutes(f.availableMinutesPerDay)}/日</strong> です。
      </p>
      <p className="text-xs text-red-800 leading-relaxed">
        <strong>目標もノルマも自動では下げません。</strong>
        今日のキューは順序が変わるだけで、やらなかった分は翌日以降に必ず戻ります。
        取れる手は次の3つで、選ぶのは利用者です。
      </p>
      <ul className="text-xs text-red-800 leading-relaxed list-disc pl-4 space-y-0.5">
        <li>学習に使う時間を増やす</li>
        <li>科目合格制を使い、今回は理論だけに絞って残りを次回受験へ回す（試験日は動かせません）</li>
        <li>不足を承知でこのまま進む</li>
      </ul>
    </div>
  )
}

const VERDICT_STYLE: Record<PaceVerdict, { label: (n: number) => string; cls: string }> = {
  done:    { label: () => '目標 達成', cls: 'text-emerald-600' },
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
          <Gauge size={14} className="text-blue-500" />間に合うか（ペース）
        </h3>
        <p className="text-xs text-gray-400">
          「設定」で試験日を登録すると、A以上への到達ペース・全問A以上の到達予測・今日の推奨ノルマが表示されます。
        </p>
      </div>
    )
  }

  const v = VERDICT_STYLE[pace.verdict]
  // ゴールは既定が「合格ライン到達」、達成後に「全問A以上」へ昇格する（課題2）。
  const goalLabel = pace.goalMode === 'pass' ? '合格ライン到達' : '全問A以上'
  const loadData = pace.weeklyLoad.map(w => ({
    week: w.weekLabel, 既存: w.due, 演習予測: w.projectedNew,
  }))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Gauge size={14} className="text-blue-500" />間に合うか（ペース）
        </h3>
        {/* 判定はこのカードの結論なので見出しの高さに置く。試験までの日数はヘッダが
            常時出しているので、ここでは繰り返さない（課題15）。 */}
        <span className={`text-xs font-semibold ${v.cls}`}>
          {pace.verdict === 'done' ? `${goalLabel} 達成` : v.label(pace.verdictDays)}
        </span>
      </div>

      {/* 主要指標 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center" title="1日あたり何問を A 以上へ引き上げているか（EWMA）">
          <p className="text-lg font-bold text-gray-800">{pace.currentPace.toFixed(1)}</p>
          <p className="text-[11px] text-gray-400">現在ペース A以上/日</p>
        </div>
        <div className="text-center" title="目標日までにゴールへ到達するために必要なペース">
          <p className="text-lg font-bold text-gray-800">{pace.requiredPace.toFixed(1)}</p>
          <p className="text-[11px] text-gray-400">必要ペース A以上/日</p>
        </div>
        <div className="text-center" title="今日 A 以上へ引き上げたい問題数">
          <p className="text-lg font-bold text-blue-600">{pace.recommendedNorm}</p>
          <p className="text-[11px] text-gray-400">今日の推奨ノルマ</p>
        </div>
      </div>

      {/* 「合格まであと何問」は①のカードが持つ（同じ値を2箇所に出さない・課題15）。
          ここは未修得の総量と到達予測だけを担う。 */}
      <div
        className="text-xs text-gray-500 border-t border-gray-100 pt-3"
        title="未着手・C・B はすべて未修得として残りに数えます"
      >
        未修得 <b className="text-gray-700">{pace.masteryRemainingQ}</b> / {pace.totalQ}問
        {pace.projectedFinishDate && (
          <> · {goalLabel} 予測 <b className="text-gray-700">{formatMD(pace.projectedFinishDate)}</b></>
        )}
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
            <Bar dataKey="演習予測" stackId="a" fill="#93c5fd" radius={[3, 3, 0, 0]} />
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

// ---- 合格までの現在地（§7.7(4) の想定得点 ＋ 理解度の内訳）----
//
// 統合前は「本番想定得点」カードと「概要カード（S/A/B/C の4枚）」と「理解度分布（円グラフ）」が
// 別々に並び、さらに『合格まで』が3つの異なる基準で3箇所に出ていた（課題15）:
//   - 想定得点カード「合格まで あと15点」        … 合格ライン基準
//   - 想定得点カード「目標70点まで あと25点」    … 合格＋マージン基準
//   - ペース分析「合格まで 32問」                … 問数
// ここでは物差しを1本にする。基準は目標（合格＋マージン）に統一し、合格ラインは
// 得点バーの目盛りとして残す。不足点はそのまま「あと何問A以上にするか」へ翻訳する。
// 理解度の内訳は、同じデータの2表現（カウント4枚＋円グラフ）をやめて積み上げバー1本にした。
const STATUS_ORDER: Status[] = ['S', 'A', 'B', 'C', '未着手']

function CurrentStandingCard({
  est, target, counts, totalQ, masteredQ,
}: {
  est: ScoreEstimate
  target: PassTarget
  counts: Record<Status, number>
  totalQ: number
  masteredQ: number
}) {
  const masteredPct = totalQ > 0 ? Math.round((masteredQ / totalQ) * 100) : 0
  const shown = STATUS_ORDER.filter(st => counts[st] > 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
        <Trophy size={14} className="text-amber-500" />合格までの現在地
      </h3>

      {est.hasData ? (
        <>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <span className={`text-4xl font-extrabold ${target.achieved ? 'text-emerald-600' : 'text-gray-800'}`}>
                {est.estimate}
              </span>
              <span className="text-sm font-bold text-gray-400"> / 100</span>
            </div>
            <p className={`text-xs font-medium mb-1 ${target.achieved ? 'text-emerald-600' : 'text-gray-500'}`}>
              {target.achieved
                ? `目標 ${target.targetScore}点に到達`
                : <>目標 {target.targetScore}点まで <span className="font-bold text-blue-600">あと{target.pointGap}点</span></>}
            </p>
          </div>

          {/* 得点バー。合格ラインと目標を同じ物差しの目盛りとして刻む。 */}
          <div>
            <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${target.achieved ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, est.estimate))}%` }}
              />
              <span className="absolute top-0 bottom-0 w-px bg-gray-400/70" style={{ left: `${est.passingScore}%` }} />
              <span className="absolute top-0 bottom-0 w-px bg-blue-500/70" style={{ left: `${Math.min(100, target.targetScore)}%` }} />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              目盛り: 合格 {est.passingScore}点 ／ 目標 {target.targetScore}点（合格＋マージン）
            </p>
          </div>

          {/* 不足点を「あと何問A以上にするか」へ翻訳する（課題2）。 */}
          <p className="text-[11px] text-gray-500">
            {target.achieved
              ? '目標に到達済み — 以降は全問A以上を目標に切り替えます'
              : target.reachable
                ? <>あと{target.pointGap}点 ＝ 収録問題を <b className="text-gray-700">あと{target.requiredQ}問</b> A以上にする</>
                : `収録済みを全問A以上にしても 約${target.maxScore}点（目標 ${target.targetScore}点）— 未収録分の入力が要ります`}
          </p>

          <p className="text-[11px] text-gray-400">
            直近理解度からの推定（学習済み {Math.round(est.studiedRatio * 100)}%・残りは当て推量0.2で計算）
            {est.actual != null && (
              <span className="text-gray-500">
                ／直近CBT実測 <b>{est.actual}点</b>（推定との差 {est.gap! >= 0 ? '+' : ''}{est.gap}）
              </span>
            )}
          </p>
        </>
      ) : (
        <p className="text-xs text-gray-400">問題に着手すると、直近の理解度から現時点の想定得点を推定します。</p>
      )}

      {/* 理解度の内訳。旧「概要カード4枚」＋「理解度分布の円グラフ」を1本に畳んだもの。 */}
      <div className="pt-3 border-t border-gray-100">
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <p className="text-[11px] font-medium text-gray-500">理解度の内訳</p>
          <p className="text-[11px] text-gray-400 whitespace-nowrap">
            完答 <b className="text-gray-600">{masteredQ}</b>/{totalQ}問（{masteredPct}%）
          </p>
        </div>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
          {shown.map(st => (
            <div
              key={st}
              title={`${st} ${counts[st]}問`}
              style={{ width: `${(counts[st] / Math.max(1, totalQ)) * 100}%`, background: STATUS_COLOR[st] }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
          {STATUS_ORDER.map(st => (
            <span key={st} className="text-[11px] text-gray-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: STATUS_COLOR[st] }} />
              {st} <b className="text-gray-700">{counts[st]}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- 理解度×時間の4象限マトリクス（§7.7(1)）----
const QUADRANTS = [
  { key: 'stable',   label: 'A・速い',   note: '安定',           cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { key: 'overtime', label: 'A・遅い',   note: 'スピード訓練',   cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'hasty',    label: '誤答・速い', note: '早とちり/知識穴', cls: 'bg-orange-50 border-orange-200 text-orange-700' },
  { key: 'priority', label: '誤答・遅い', note: '最優先弱点',      cls: 'bg-red-50 border-red-200 text-red-700' },
] as const

function QuadrantCard({ m }: { m: QuadrantMatrix }) {
  if (m.measuredN === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1.5">
          <Timer size={14} className="text-indigo-500" />理解度 × 解答時間
        </h3>
        <p className="text-xs text-gray-400">
          解答時間の計測データがまだありません。「問題を解く」から解いてA/B/Cを記録すると、
          本番の持ち時間（A問題5分・B問題10分）と比べた「速い/遅い」で弱点を分類します。
        </p>
      </div>
    )
  }
  // 訓練対象（A遅い＋誤答遅い）を「本番の持ち時間に対する超過率」の降順で上位提示。
  const overrun = (t: QuadrantItem) => t.seconds / t.limitSeconds
  const targets = [...m.overtime, ...m.priority].sort((a, b) => overrun(b) - overrun(a)).slice(0, 5)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Timer size={14} className="text-indigo-500" />理解度 × 解答時間
        </h3>
        <span className="text-[10px] text-gray-400">計測 {m.measuredN}/{m.attemptedN}問</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {QUADRANTS.map(qd => {
          const items = m[qd.key]
          return (
            <div key={qd.key} className={`rounded-xl border p-2.5 ${qd.cls}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold">{qd.label}</span>
                <span className="text-lg font-bold">{items.length}</span>
              </div>
              <p className="text-[10px] opacity-80">{qd.note}</p>
            </div>
          )
        })}
      </div>
      {targets.length > 0 && (
        <div className="pt-1 border-t border-gray-100">
          <p className="text-[11px] font-medium text-gray-500 mb-1">時間超過の訓練対象（遅い順）</p>
          <ul className="space-y-1">
            {targets.map(t => (
              <li key={t.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 truncate">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${t.status === 'A' || t.status === 'S' ? 'bg-amber-400' : 'bg-red-400'}`} />
                  {t.chapter} 問{t.number}
                </span>
                <span className="text-gray-400 whitespace-nowrap ml-2">
                  {formatDuration(t.seconds)}（中央値比 {t.ratio.toFixed(1)}倍）
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[10px] text-gray-300">
        「遅い」は本番の持ち時間（A問題5分・B問題10分）超え。「A・遅い」は正答できていても
        本番では時間切れで失点しやすい隠れ弱点です。直前期の訓練対象に。
      </p>
    </div>
  )
}

export default function DashboardView({
  data, chapters, reviews, totalQ, masteredQ, pace, weakness, learningCurve, quadrant, scoreEstimate,
  passTarget, feasibility,
}: {
  data: { counts: Record<Status, number> }
  chapters: Chapter[]
  reviews: Record<string, Review>
  totalQ: number
  masteredQ: number
  pace: PaceResult
  weakness: ChapterWeakness[]
  learningCurve: WeeklyLearningPoint[]
  quadrant: QuadrantMatrix
  scoreEstimate: ScoreEstimate
  passTarget: PassTarget
  /** コア完遂の実現可能性（policy.ts §3.6）。shortfall のときだけバナーを出す。 */
  feasibility: Feasibility
}) {
  // 章別の3つの表（伸びしろ・弱点・進捗）を1行に束ねる（課題15）。既存の出力を
  // 突き合わせるだけなので、新しい集計はここでも増やしていない。
  const chapterRows = useMemo(
    () => buildChapterPriority(chapters, reviews, weakness, scoreEstimate.chapters),
    [chapters, reviews, weakness, scoreEstimate],
  )

  // 分析タブは「週末に読んで、次の1週間の使い方を決める」画面（§3 課題9）。
  // 答えるべき問いの順に4枚だけ積む（課題15）:
  //   ① いま何点で、あと何が足りないか   … 合格までの現在地
  //   ② 間に合うのか                     … ペース
  //   ③ どの章に時間を使うのか           … 章別の優先順位
  //   ④ やり方に問題はないか             … 学習曲線・理解度×解答時間
  return (
    <div className="space-y-4">
      <FeasibilityBanner f={feasibility} />

      <CurrentStandingCard
        est={scoreEstimate}
        target={passTarget}
        counts={data.counts}
        totalQ={totalQ}
        masteredQ={masteredQ}
      />

      <PaceCard pace={pace} />

      <ChapterPriorityTable rows={chapterRows} />

      <LearningCurve points={learningCurve} />

      <QuadrantCard m={quadrant} />
    </div>
  )
}
