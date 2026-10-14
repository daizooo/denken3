// 公開模試の得点入力フォーム（licensehub-expansion.md §10.2・PR-I）。lic_external_scores（migration 026）に1回＝1行で保存する。
// 式ごとに全科目を入れる（その式を受けていなければ全科目を空欄のまま）。保存すると5月末ゲートの判定に反映される。
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { todayJST } from '../../lib/date'
import { SHAROUSHI_SCORING } from '../../data/sharoushi/index.ts'
import { parseSectionScores, type ExternalScore } from '../../lib/license/cutoff'

export const EXTERNAL_TABLE = 'lic_external_scores'
const EXAM_ID = 'sharoushi'

export default function ExternalScoreForm({ onSaved }: { onSaved: (row: ExternalScore) => void }) {
  const [label, setLabel] = useState('')
  const [takenOn, setTakenOn] = useState(todayJST())
  const [memo, setMemo] = useState('')
  const [raw, setRaw] = useState<Record<string, Record<string, string>>>({ sentaku: {}, taku: {} })
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const [sentaku, taku] = (['sentaku', 'taku'] as const).map(id =>
      parseSectionScores(SHAROUSHI_SCORING.sections.find(s => s.id === id)!, raw[id]))
    const errs = [...sentaku.errors, ...taku.errors]
    if (!label.trim()) errs.unshift('模試の名前を入れてください')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(takenOn)) errs.push('受験日を入れてください')
    if (errs.length === 0 && !sentaku.scores && !taku.scores) errs.push('選択式か択一式の得点を入れてください')
    setErrors(errs)
    if (errs.length > 0) return
    setSaving(true)
    const { data, error } = await supabase.from(EXTERNAL_TABLE)
      .insert({ exam_id: EXAM_ID, label: label.trim(), taken_on: takenOn, sentaku_scores: sentaku.scores, taku_scores: taku.scores, memo })
      .select('id, label, taken_on, sentaku_scores, taku_scores, memo')
      .single()
    setSaving(false)
    if (error || !data) { setErrors([`保存に失敗しました: ${error?.message ?? '不明'}`]); return }
    onSaved(data as ExternalScore)
    setLabel(''); setMemo(''); setRaw({ sentaku: {}, taku: {} })
  }

  return (
    <div className="border rounded-xl p-2 space-y-2 text-sm">
      <h3 className="text-xs font-bold text-gray-700">公開模試の得点を入力</h3>
      <div className="flex flex-wrap gap-2">
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="模試の名前（例: 〇〇公開模試 第1回）"
          className="flex-1 min-w-40 border rounded px-2 py-1" />
        <input type="date" value={takenOn} onChange={e => setTakenOn(e.target.value)} className="border rounded px-2 py-1" />
      </div>
      {SHAROUSHI_SCORING.sections.map(sec => (
        <div key={sec.id}>
          <p className="text-xs text-gray-500">{sec.name}（各 0〜{sec.subjects[0]?.maxPoints}。受けていなければ空欄）</p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
            {sec.subjects.map(s => (
              <label key={s.code} className="text-[11px] text-gray-600 flex flex-col">
                {s.code}
                <input inputMode="numeric" value={raw[sec.id][s.code] ?? ''} title={s.name}
                  onChange={e => setRaw(r => ({ ...r, [sec.id]: { ...r[sec.id], [s.code]: e.target.value } }))}
                  className="border rounded px-1 py-0.5 text-sm w-full" />
              </label>
            ))}
          </div>
        </div>
      ))}
      <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="メモ（任意）" className="w-full border rounded px-2 py-1" />
      {errors.length > 0 && <ul className="text-xs text-red-700 list-disc pl-4">{errors.map(e => <li key={e}>{e}</li>)}</ul>}
      <button onClick={() => { void save() }} disabled={saving}
        className="px-3 py-1 rounded bg-indigo-600 text-white text-xs disabled:opacity-50">
        {saving ? '保存中…' : '保存'}
      </button>
    </div>
  )
}
