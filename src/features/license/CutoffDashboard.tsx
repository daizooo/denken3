// 足切りダッシュボード・5月末ゲート（licensehub-expansion.md §10.2・PR-I）の画面。
// - 採点科目別（選択式8・択一7）: 肢の正答率（直近）・想起確率の平均・本番形式模試と公開模試の得点・想定得点（推定）・足切りラインとの差
// - 5月末ゲートの判定（青・黄・赤）。入力元は公開模試を優先し、無ければ本番形式模試（既習を含む）
// - 公開模試の得点入力（lic_external_scores）と一覧
// - 学習科目ごとの進級判定（judgeProgression の結果を並べるだけ。再計算の規則は progression.ts）
// 集計は src/lib/license/cutoff.ts の純関数。集計に入れる肢は law_status='ok' だけ。
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { todayJST } from '../../lib/date'
import { retrievability } from '../../lib/fsrs'
import type { ExamDefinition, MasterQuestion, Review } from '../../domain/types'
import { SHAROUSHI_GATE_THRESHOLDS, SHAROUSHI_PROGRESSION, SHAROUSHI_SCORING } from '../../data/sharoushi/index.ts'
import {
  GATE_LABELS, SOURCE_LABELS, judgeGate, subjectRows,
  type CutoffItem, type ExternalScore, type FinishedMock, type GateVerdict, type ScoreSource,
} from '../../lib/license/cutoff'
import { MOCK_SCORE_NOTE } from '../../lib/license/textMock'
import { judgeProgression } from '../../lib/license/progression'
import { FIXTURE_YEARS } from '../../lib/license/ingest/schema.ts'
import ExternalScoreForm, { EXTERNAL_TABLE } from './ExternalScoreForm'

const EXAM_ID = 'sharoushi'
const PAGE = 1000

const GATE_CLS: Record<GateVerdict, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-400',
  yellow: 'bg-amber-100 text-amber-800 border-amber-400',
  red: 'bg-red-100 text-red-800 border-red-400',
  insufficient: 'bg-gray-100 text-gray-600 border-gray-300',
}

const PROGRESSION_LABEL = { pass: '合格', waiting: '定着の確認待ち', fail: '不合格', empty: '肢なし' } as const

async function loadItems(userId: string): Promise<CutoffItem[]> {
  const out: CutoffItem[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('lic_items')
      .select('id, scored_subject, study_subject, law_status')
      .eq('user_id', userId).order('id').range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...((data ?? []) as CutoffItem[]))
    if (!data || data.length < PAGE) return out
  }
}

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`)
const pts = (v: number | null) => (v == null ? '—' : String(v))

function sourceText(src: ScoreSource | null): string {
  if (!src) return '得点なし'
  return `${SOURCE_LABELS[src.kind]}: ${src.label}（${src.date}）`
}

export default function CutoffDashboard({ userId, exam, reviews, onClose }: {
  userId: string
  exam: ExamDefinition
  reviews: Record<string, Review>
  onClose: () => void
}) {
  const today = todayJST()
  const [items, setItems] = useState<CutoffItem[] | null>(null)
  const [externals, setExternals] = useState<ExternalScore[]>([])
  const [mocks, setMocks] = useState<FinishedMock[]>([])
  const [error, setError] = useState<string | null>(null)
  const [withFixtures, setWithFixtures] = useState(false)

  useEffect(() => {
    let alive = true
    loadItems(userId).then(xs => { if (alive) setItems(xs) }, e => { if (alive) setError(`肢を読めません: ${(e as Error).message}`) })
    supabase.from(EXTERNAL_TABLE).select('id, label, taken_on, sentaku_scores, taku_scores, memo')
      .eq('user_id', userId).eq('exam_id', EXAM_ID).order('taken_on', { ascending: false })
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) setError(`公開模試の得点を読めません（migration 026 が未適用の可能性）: ${e.message}`)
        else setExternals((data ?? []) as ExternalScore[])
      })
    supabase.from('denken_mock_sessions').select('subject_id, paper_id, finished_at, section_scores')
      .eq('user_id', userId).eq('exam_id', EXAM_ID).eq('status', 'finished').eq('mode', 'cbt')
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) setError(`本番形式模試の得点を読めません: ${e.message}`)
        else setMocks((data ?? []) as FinishedMock[])
      })
    return () => { alive = false }
  }, [userId])

  const studyNames = useMemo(() => Object.fromEntries(exam.subjects.map(s => [s.id, String(s.name)])), [exam])

  const input = useMemo(() => ({
    model: SHAROUSHI_SCORING,
    items: items ?? [],
    statusOf: (id: string) => reviews[id]?.status,
    recallOf: (id: string) => retrievability(reviews[id], today),
    externals, mocks,
    thresholds: SHAROUSHI_GATE_THRESHOLDS,
    excludeYears: withFixtures ? [] : FIXTURE_YEARS,
    studyNames,
  }), [items, reviews, today, externals, mocks, withFixtures, studyNames])

  const rows = useMemo(() => (items ? subjectRows(input) : []), [items, input])
  const gate = useMemo(() => (items ? judgeGate(input) : null), [items, input])
  const progression = useMemo(() => exam.subjects.map(s => {
    const qs: MasterQuestion[] = s.chapters.flatMap(c => c.questions)
    return { subject: s, result: judgeProgression(qs, id => reviews[id]?.review_history ?? [], SHAROUSHI_PROGRESSION) }
  }), [exam, reviews])

  const remove = async (id: string) => {
    if (!window.confirm('この公開模試の得点を削除しますか？')) return
    const { error: e } = await supabase.from(EXTERNAL_TABLE).delete().eq('user_id', userId).eq('id', id)
    if (e) setError(`削除できません: ${e.message}`)
    else setExternals(xs => xs.filter(x => x.id !== id))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-3">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">足切りダッシュボード・5月末ゲート</h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        {!items && !error && <p className="text-xs text-gray-500">読み込み中…</p>}

        {gate && (
          <section className="border rounded-xl p-2 space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-gray-700">5月末ゲート</span>
              <span className={`text-xs border rounded px-2 py-0.5 ${GATE_CLS[gate.verdict]}`}>{GATE_LABELS[gate.verdict]}</span>
              <span className="text-xs text-gray-500">
                択一 {pts(gate.takuTotal)}・選択式 {pts(gate.sentakuTotal)}・足切り科目 {gate.floorFailures.length}
              </span>
            </div>
            {gate.reasons.length > 0 && <p className="text-xs text-gray-600">{gate.reasons.join(' ／ ')}</p>}
            <p className="text-xs text-gray-500">択一の入力元: {sourceText(gate.taku)}　選択式の入力元: {sourceText(gate.sentaku)}</p>
            {gate.includesStudied && <p className="text-xs text-amber-700">本番形式模試の得点は既習の肢を含みます。{MOCK_SCORE_NOTE}</p>}
            <p className="text-[11px] text-gray-400">
              閾値は推定値です（青: 択一{SHAROUSHI_GATE_THRESHOLDS.blue.taku}以上・選択式{SHAROUSHI_GATE_THRESHOLDS.blue.sentaku}以上・足切り科目{SHAROUSHI_GATE_THRESHOLDS.blue.maxFloorFailures}以下／
              黄: 択一{SHAROUSHI_GATE_THRESHOLDS.redTakuBelow}〜{SHAROUSHI_GATE_THRESHOLDS.blue.taku - 1}・足切り科目{SHAROUSHI_GATE_THRESHOLDS.yellowFloorFailures}／
              赤: 択一{SHAROUSHI_GATE_THRESHOLDS.redTakuBelow}未満・1周目未完了・一般常識が未着手）。入力元は公開模試を優先し、無ければ本番形式模試。
            </p>
          </section>
        )}

        {items && SHAROUSHI_SCORING.sections.map(sec => (
          <section key={sec.id} className="space-y-1">
            <h3 className="text-xs font-bold text-gray-700">{sec.name}（足切り {sec.subjects[0]?.floor} 点）</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-500">
                  <tr>
                    <th className="text-left font-normal">科目</th>
                    <th className="font-normal">正答率</th>
                    <th className="font-normal">想起確率</th>
                    <th className="font-normal">本番形式模試<br />（既習を含む）</th>
                    <th className="font-normal">公開模試</th>
                    <th className="font-normal">想定得点<br />（推定）</th>
                    <th className="font-normal">足切りとの差</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter(r => r.section === sec.id).map(r => (
                    <tr key={r.code} className="border-t text-center">
                      <td className="text-left" title={r.name}>{r.code}</td>
                      <td>
                        {r.insufficient
                          ? <span className="text-gray-400">データ不足（{r.attempted}/{r.items}）</span>
                          : `${pct(r.accuracy)}（${r.attempted}肢）`}
                      </td>
                      <td>{pct(r.recallAvg)}</td>
                      <td>{pts(r.mockScore)}</td>
                      <td>{pts(r.externalScore)}</td>
                      <td>{r.estimated == null ? '—' : `推定 ${r.estimated}`}</td>
                      <td className={r.floorGap != null && r.floorGap < 0 ? 'text-red-700 font-bold' : ''}>
                        {r.floorGap == null ? '—' : `${r.floorGap >= 0 ? '+' : ''}${r.floorGap}`}
                        {r.basis && <span className="block text-[10px] text-gray-400">{SOURCE_LABELS[r.basis]}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        {items && (
          <p className="text-[11px] text-gray-400">
            正答率は直近の結果（正解・迷いの正解／誤答）で、直近の結果がある肢が {SHAROUSHI_GATE_THRESHOLDS.minAttempted} 未満の科目は「データ不足」。
            想定得点は肢の正答率からの暫定換算（択一は正答率の{SHAROUSHI_GATE_THRESHOLDS.estimateExponent}乗）で、模試で較正するまで参考値です。
            法改正の確認待ちの肢は集計に入れません。
          </p>
        )}
        <label className="flex items-center gap-1 text-[11px] text-gray-500">
          <input type="checkbox" checked={withFixtures} onChange={e => setWithFixtures(e.target.checked)} />
          フィクスチャの年度（{FIXTURE_YEARS.join('・')}）を含める（動作確認用）
        </label>

        <ExternalScoreForm onSaved={row => setExternals(xs => [row, ...xs])} />
        {externals.length > 0 && (
          <ul className="text-xs space-y-1">
            {externals.map(x => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 border-b pb-1">
                <span className="text-gray-700">{x.taken_on} {x.label}</span>
                {(['sentaku', 'taku'] as const).map(id => {
                  const s = id === 'taku' ? x.taku_scores : x.sentaku_scores
                  return s && <span key={id} className="text-gray-500">{id === 'taku' ? '択一' : '選択式'} {Object.values(s).reduce((a, b) => a + b, 0)}</span>
                })}
                {x.memo && <span className="text-gray-400">{x.memo}</span>}
                <button onClick={() => { void remove(x.id) }} className="ml-auto text-red-600">削除</button>
              </li>
            ))}
          </ul>
        )}

        <section className="space-y-1">
          <h3 className="text-xs font-bold text-gray-700">進級判定（学習科目ごと）</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 text-xs">
            {progression.map(({ subject, result }) => (
              <div key={subject.id} className="border rounded px-2 py-1">
                <span className="font-bold text-gray-700">{subject.name}</span> {PROGRESSION_LABEL[result.verdict]}
                {result.current.total > 0 && <span className="block text-gray-400">{result.current.attempted}/{result.current.total}肢</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
