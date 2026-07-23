import { useEffect, useState } from 'react'
import { CalendarDays, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ExamPlan } from '../../domain/types'

// 試験日程設定（§7.1）。資格×科目ごとに denken_exam_plans を編集する。
// CBT期・筆記日程はマスターに持たず手入力（年度で変わるため）。既知の確定日程は説明文に表示。
export default function SettingsView({
  userId, examId, subjectId, subjectName, plan, onSaved,
}: {
  userId: string
  examId: string
  subjectId: string
  subjectName: string
  plan: ExamPlan | null
  onSaved: (plan: ExamPlan) => void
}) {
  const [examDate, setExamDate] = useState('')
  const [label, setLabel] = useState('')
  const [appStart, setAppStart] = useState('')
  const [appEnd, setAppEnd] = useState('')
  const [bunyaTarget, setBunyaTarget] = useState('')
  const [nendoStart, setNendoStart] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // 科目を切り替えたら、その科目の既存プランでフォームを初期化する。
  useEffect(() => {
    setExamDate(plan?.exam_date ?? '')
    setLabel(plan?.label ?? '')
    setAppStart(plan?.application_start ?? '')
    setAppEnd(plan?.application_end ?? '')
    setBunyaTarget(plan?.bunya_target_date ?? '')
    setNendoStart(plan?.nendo_start_date ?? '')
    setMsg(null)
  }, [plan, subjectId])

  const save = async () => {
    if (!examDate) { setMsg('試験日は必須です'); return }
    setSaving(true)
    setMsg(null)
    const row = {
      user_id: userId,
      exam_id: examId,
      subject_id: subjectId,
      label,
      exam_date: examDate,
      application_start: appStart || null,
      application_end: appEnd || null,
      bunya_target_date: bunyaTarget || null,
      nendo_start_date: nendoStart || null,
    }
    const { error } = await supabase.from('denken_exam_plans').upsert(row)
    setSaving(false)
    if (error) { console.error(error); setMsg('保存に失敗しました'); return }
    setMsg('保存しました')
    onSaved({
      exam_id: examId,
      subject_id: subjectId,
      label,
      exam_date: examDate,
      application_start: appStart || null,
      application_end: appEnd || null,
      bunya_target_date: bunyaTarget || null,
      nendo_start_date: nendoStart || null,
    })
  }

  const field = (
    labelText: string,
    value: string,
    onChange: (v: string) => void,
    hint?: string,
  ) => (
    <div>
      <label className="text-xs font-medium text-gray-600">{labelText}</label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-300 bg-white"
      />
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-800">試験日程 — {subjectName}</h2>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">ラベル</label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="例: 2027年2月 下期CBT"
            className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-300 bg-white"
          />
        </div>

        {field('試験日 *', examDate, setExamDate, 'CBTの受験日。カウントダウン・復習の試験日クリップに使います')}

        <div className="grid grid-cols-2 gap-3">
          {field('申込開始', appStart, setAppStart, '例: 2026-11-09')}
          {field('申込締切', appEnd, setAppEnd, '締切前にリマインド表示（例: 2026-11-26）')}
        </div>

        {field('分野別 完走目標日', bunyaTarget, setBunyaTarget, '未設定なら試験日の90日前を目標として自動計算')}
        {field('年度別演習 開始予定日', nendoStart, setNendoStart, '年度別（CBT模試）を始める予定日')}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save size={14} /> {saving ? '保存中...' : '保存'}
          </button>
          {msg && <span className="text-xs text-gray-500">{msg}</span>}
        </div>
      </div>

      <p className="text-[11px] text-gray-400 px-1 leading-relaxed">
        休止期間の事前登録はありません。産後などで学習ペースが変動しても、日々の実績から
        現在ペースを自動で推定し続け（分析タブ）、計画を毎日再計算します。
      </p>
    </div>
  )
}
