// 目標日の逆算の設定（licensehub-expansion.md §10.1・§15の9・§17）。社労士だけ。
//
// 本試験日・基準点・科目の重み・学習順・書籍の発売日・目標日の上書きを編集し、その場で computeTargets で再計算する。
// 保存すると、設定を denken_settings（plan_anchors / plan_weights / plan_order。migration 027）に、
// 各科目の本試験日・目標日・上書きの印を denken_exam_plans（exam_date / bunya_target_date / target_overridden）に書く。
// 上書きした科目は再計算で目標日を変えない。
import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toDateStr } from '../../lib/date'
import type { ExamPlan } from '../../domain/types'
import { computeTargets, resolvePlanSettings, type PlanAnchors } from '../../lib/license/plan'
import { SHAROUSHI_SUBJECTS } from '../../data/sharoushi/index.ts'
import { SHAROUSHI_PLAN_ANCHORS, SHAROUSHI_PLAN_ORDER, SHAROUSHI_PLAN_WEIGHTS } from '../../data/sharoushi/plan.ts'

const EXAM_ID = 'sharoushi'
const DEFAULT_EXAM_DATE = '2027-08-22'
const DEFAULTS = { anchors: SHAROUSHI_PLAN_ANCHORS, weights: SHAROUSHI_PLAN_WEIGHTS, order: SHAROUSHI_PLAN_ORDER }
const NAME: Record<string, string> = Object.fromEntries(SHAROUSHI_SUBJECTS.map(s => [s.id, s.name]))
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type PlanRow = ExamPlan & { target_overridden: boolean }

function toPlan(p: Record<string, unknown>): PlanRow {
  const d = (v: unknown) => (v ? toDateStr(v as string) : null)
  return {
    exam_id: p.exam_id as string,
    subject_id: p.subject_id as string,
    label: (p.label as string | null) ?? '',
    exam_date: d(p.exam_date),
    application_start: d(p.application_start),
    application_end: d(p.application_end),
    bunya_target_date: d(p.bunya_target_date),
    nendo_start_date: d(p.nendo_start_date),
    target_overridden: p.target_overridden === true,
  }
}

export default function PlanTargets({
  userId, onClose, onSaved,
}: {
  userId: string
  onClose: () => void
  onSaved: (plan: ExamPlan) => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<Record<string, PlanRow>>({})
  const [examDate, setExamDate] = useState(DEFAULT_EXAM_DATE)
  const [anchors, setAnchors] = useState<PlanAnchors>(SHAROUSHI_PLAN_ANCHORS)
  const [weights, setWeights] = useState<Record<string, number>>(SHAROUSHI_PLAN_WEIGHTS)
  const [order, setOrder] = useState<string[]>(SHAROUSHI_PLAN_ORDER)
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('denken_settings').select('plan_anchors,plan_weights,plan_order').eq('user_id', userId).maybeSingle(),
      supabase.from('denken_exam_plans').select('*').eq('user_id', userId).eq('exam_id', EXAM_ID),
    ]).then(([s, p]) => {
      if (!alive) return
      if (s.error) setMsg('設定を読めません（migration 027 が未適用の可能性）。既定値で表示します')
      const r = resolvePlanSettings(DEFAULTS, {
        anchors: s.data?.plan_anchors, weights: s.data?.plan_weights, order: s.data?.plan_order,
      })
      setAnchors(r.anchors); setWeights(r.weights); setOrder(r.order)
      if (p.error) setMsg(`試験日程を読めません: ${p.error.message}`)
      const map: Record<string, PlanRow> = {}
      for (const row of p.data ?? []) map[row.subject_id] = toPlan(row)
      setRows(map)
      // 本試験日は全科目で共通。学習順で最初に見つかった行の値を使う
      const first = r.order.map(id => map[id]?.exam_date).find(Boolean)
      if (first) setExamDate(first)
      setOverrides(Object.fromEntries(Object.values(map)
        .filter(x => x.target_overridden && x.bunya_target_date)
        .map(x => [x.subject_id, x.bunya_target_date as string])))
      setLoaded(true)
    })
    return () => { alive = false }
  }, [userId])

  const valid = DATE_RE.test(examDate) && DATE_RE.test(anchors.startDate) && DATE_RE.test(anchors.gateDate)
  const result = useMemo(
    () => (valid ? computeTargets(examDate, anchors, weights, order, overrides) : null),
    [valid, examDate, anchors, weights, order, overrides],
  )
  const targetOf = (id: string) => result?.targets.find(t => t.subjectId === id) ?? null

  const move = (i: number, d: -1 | 1) => setOrder(prev => {
    const j = i + d
    if (j < 0 || j >= prev.length) return prev
    const next = [...prev]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const setAnchor = <K extends keyof PlanAnchors>(k: K, v: PlanAnchors[K]) => setAnchors(prev => ({ ...prev, [k]: v }))
  const setNum = (k: 'finalPhaseWeeks' | 'throughWeeks' | 'minPracticeDays', v: string) => {
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0) setAnchor(k, n)
  }

  const save = async () => {
    if (!result) { setMsg('日付を YYYY-MM-DD で入れてください'); return }
    setSaving(true); setMsg(null)
    const s = await supabase.from('denken_settings').upsert(
      { user_id: userId, plan_anchors: anchors, plan_weights: weights, plan_order: order },
      { onConflict: 'user_id' },
    )
    if (s.error) { setSaving(false); setMsg(`設定を保存できません: ${s.error.message}`); return }
    // label などの他の列は送らない（既存の値を変えない）。行が無い科目は作る
    const p = await supabase.from('denken_exam_plans').upsert(result.targets.map(t => ({
      user_id: userId, exam_id: EXAM_ID, subject_id: t.subjectId,
      exam_date: examDate, bunya_target_date: t.target, target_overridden: t.overridden,
    })), { onConflict: 'user_id,exam_id,subject_id' })
    setSaving(false)
    if (p.error) { setMsg(`目標日を保存できません: ${p.error.message}`); return }
    const next = { ...rows }
    for (const t of result.targets) {
      const prev = rows[t.subjectId]
      next[t.subjectId] = {
        exam_id: EXAM_ID, subject_id: t.subjectId, label: prev?.label ?? '',
        application_start: prev?.application_start ?? null, application_end: prev?.application_end ?? null,
        nendo_start_date: prev?.nendo_start_date ?? null,
        exam_date: examDate, bunya_target_date: t.target, target_overridden: t.overridden,
      }
      const { target_overridden: _o, ...plan } = next[t.subjectId]
      void _o
      onSaved(plan)
    }
    setRows(next)
    setMsg('保存しました（目標日を各科目の試験日程に書きました）')
  }

  const dateInput = (value: string, onChange: (v: string) => void) => (
    <input type="date" value={value} onChange={e => onChange(e.target.value)} className="border rounded px-2 py-1 text-sm" />
  )
  const numInput = (value: number, onChange: (v: string) => void) => (
    <input type="number" min={0} value={value} onChange={e => onChange(e.target.value)} className="w-16 border rounded px-2 py-1 text-sm" />
  )
  const m = result?.milestones

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-4">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">目標日の逆算（社労士）</h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>
        {!loaded && <p className="text-sm text-gray-500">読み込み中…</p>}

        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <label className="space-y-1">本試験日（全科目）<div>{dateInput(examDate, setExamDate)}</div></label>
          <label className="space-y-1">演習の開始日<div>{dateInput(anchors.startDate, v => setAnchor('startDate', v))}</div></label>
          <label className="space-y-1">模試ゲート<div>{dateInput(anchors.gateDate, v => setAnchor('gateDate', v))}</div></label>
          <label className="space-y-1">直前期の開始（本試験の何週前）<div>{numInput(anchors.finalPhaseWeeks, v => setNum('finalPhaseWeeks', v))}</div></label>
          <label className="space-y-1">通し演習の開始（ゲートの何週前）<div>{numInput(anchors.throughWeeks, v => setNum('throughWeeks', v))}</div></label>
          <label className="space-y-1">最短演習日数（発売日から）<div>{numInput(anchors.minPracticeDays, v => setNum('minPracticeDays', v))}</div></label>
        </div>
        <p className="text-[11px] text-gray-400">模試ゲートは日付で持つため、本試験日を変えても動きません。必要ならゲートも変えてください。</p>

        {m && (
          <p className="text-xs text-gray-600 leading-relaxed">
            演習の開始 {m.startDate} → 1周目の完了期限 {m.firstRoundDeadline} → 通し演習の開始 {m.throughStart}
            → 模試ゲート {m.gateDate} → 直前期の開始 {m.finalPhaseStart} → 本試験 {m.examDate}
          </p>
        )}
        {result?.warnings.map(w => <p key={w} className="text-xs text-red-600">{w}</p>)}

        <div className="space-y-2">
          <p className="text-xs text-gray-500">学習順に並べ、開始日から1周目の完了期限までを重みで按分します。上書きした科目は再計算で変わりません。</p>
          {order.map((id, i) => {
            const t = targetOf(id)
            const overridden = id in overrides
            return (
              <div key={id} className="border rounded-lg p-2 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-6 text-xs text-gray-400">{i + 1}</span>
                  <span className="w-10 font-medium text-gray-800">{NAME[id] ?? id}</span>
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="上へ" className="p-1 border rounded disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="下へ" className="p-1 border rounded disabled:opacity-30"><ArrowDown size={14} /></button>
                  <span className="text-xs text-gray-500">重み</span>
                  {numInput(weights[id] ?? 0, v => { const n = Number(v); if (Number.isFinite(n) && n >= 0) setWeights(prev => ({ ...prev, [id]: n })) })}
                  <span className="text-xs text-gray-500">発売日</span>
                  {dateInput(anchors.releaseDates[id] ?? '', v => setAnchor('releaseDates', { ...anchors.releaseDates, [id]: v }))}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm pl-8">
                  <span className="text-xs text-gray-500">目標日</span>
                  {overridden ? (
                    <>
                      {dateInput(overrides[id], v => setOverrides(prev => ({ ...prev, [id]: v })))}
                      <span className="text-[11px] text-gray-400">（逆算 {t?.computed ?? '—'}）</span>
                      <button
                        onClick={() => setOverrides(prev => { const { [id]: _x, ...rest } = prev; void _x; return rest })}
                        className="px-2 py-0.5 rounded border text-xs text-gray-700"
                      >
                        上書きを解除
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-gray-800">{t?.target ?? (weights[id] > 0 ? '—' : '重み0（対象外）')}</span>
                      {t && (
                        <button
                          onClick={() => setOverrides(prev => ({ ...prev, [id]: t.target }))}
                          className="px-2 py-0.5 rounded border text-xs text-gray-700"
                        >
                          上書き
                        </button>
                      )}
                    </>
                  )}
                </div>
                {t?.warning && <p className="text-xs text-amber-700 pl-8">⚠ {t.warning}</p>}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void save()}
            disabled={!loaded || saving || !result}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存（目標日を書く）'}
          </button>
          <button
            onClick={() => { setAnchors(SHAROUSHI_PLAN_ANCHORS); setWeights(SHAROUSHI_PLAN_WEIGHTS); setOrder(SHAROUSHI_PLAN_ORDER) }}
            className="px-3 py-2 rounded-lg border text-sm text-gray-700"
          >
            基準点・重み・学習順を既定に戻す
          </button>
          {msg && <span className="w-full text-xs text-gray-500">{msg}</span>}
        </div>
      </div>
    </div>
  )
}
