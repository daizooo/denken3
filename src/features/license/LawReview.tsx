// 要確認一覧（法改正フラグ）— licensehub-expansion.md §9・PR-K。
//
// 公式PDF由来で law_status が unchecked / review の肢を年度・科目別に見て、ok / review / excluded に更新する。
// law_note は追記のみ（問題誤りの公表などの既存の注記を消さない）。法令基準日（denken_settings.law_base_date）もここで変える。
// 確認待ちの肢は、復習キュー・肢モード・一括コピー・集計に入らない（src/lib/license/lawStatus.ts）。
// ok にした肢が復習・集計に入るのは、索引の再生成（scripts/license/build-master.mjs）のPRがデプロイされた後。
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { todayJST } from '../../lib/date'
import { parseItemId, type LawStatus } from '../../domain/license'
import { ITEM_BODY_COLUMNS, type ItemBody } from '../../lib/license/itemBody'
import { writeBodies } from '../../lib/license/bodyCache'
import { DEFAULT_LAW_BASE_DATE, appendLawNote } from '../../lib/license/lawRisk'
import {
  LAW_DECISIONS, PENDING_LAW_STATUSES, groupPending, lawDecisionNote, lawStatusLabel,
} from '../../lib/license/lawStatus'

type Row = ItemBody & { law_note: string | null }

const PAGE = 1000

async function fetchPending(userId: string): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('lic_items')
      .select(`${ITEM_BODY_COLUMNS},law_note`)
      .eq('user_id', userId)
      .in('law_status', [...PENDING_LAW_STATUSES])
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...((data ?? []) as unknown as Row[]))
    if (!data || data.length < PAGE) return out
  }
}

const yearOf = (id: string) => parseItemId(id)?.year ?? '(不明)'

export default function LawReview({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [baseDate, setBaseDate] = useState(DEFAULT_LAW_BASE_DATE)
  const [baseDateMsg, setBaseDateMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<{ year: string; subject: string } | null>(null)
  const [onlyReview, setOnlyReview] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchPending(userId)
      .then(r => { if (alive) setRows(r) })
      .catch(e => { if (alive) setError(`一覧を取得できません: ${e.message ?? e}`) })
    supabase.from('denken_settings').select('law_base_date').eq('user_id', userId).maybeSingle()
      .then(({ data, error: e }) => {
        if (!alive) return
        if (e) setBaseDateMsg('法令基準日の設定を読めません（migration 023 が未適用の可能性）。既定値で表示します')
        else if (data?.law_base_date) setBaseDate(data.law_base_date)
      })
    return () => { alive = false }
  }, [userId])

  const groups = useMemo(
    () => groupPending((rows ?? []).map(r => ({ year: yearOf(r.id), subject: r.scored_subject, law_status: r.law_status }))),
    [rows],
  )
  const shown = useMemo(() => (rows ?? []).filter(r =>
    (!filter || (yearOf(r.id) === filter.year && r.scored_subject === filter.subject))
    && (!onlyReview || r.law_status === 'review')), [rows, filter, onlyReview])

  const saveBaseDate = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) { setBaseDateMsg('日付を YYYY-MM-DD で入れてください'); return }
    const { error: e } = await supabase.from('denken_settings')
      .upsert({ user_id: userId, law_base_date: baseDate }, { onConflict: 'user_id' })
    setBaseDateMsg(e ? `保存できません: ${e.message}` : '保存しました。基準日を変えたら、手順書に従って再照合してください')
  }

  const decide = async (row: Row, status: LawStatus) => {
    setSaving(row.id)
    const law_note = appendLawNote(row.law_note, lawDecisionNote(status, notes[row.id] ?? '', baseDate, todayJST()))
    // 読み込んだ時点の状態のままのときだけ更新する（別の端末・SQL での更新を上書きしない）
    const { data, error: e } = await supabase.from('lic_items')
      .update({ law_status: status, law_note })
      .eq('user_id', userId).eq('id', row.id).eq('law_status', row.law_status)
      .select('id')
    setSaving(null)
    if (e || !data || data.length === 0) {
      setError(e ? `${row.id} を更新できません: ${e.message}` : `${row.id} は別の場所で更新されています。開き直してください`)
      return
    }
    const next: Row = { ...row, law_status: status, law_note }
    // 端末の本文キャッシュも新しい状態にする（キャッシュが古い law_status のまま出題・除外され続けないように）
    const { law_note: _n, ...body } = next
    void _n
    void writeBodies(userId, [body])
    setRows(prev => (prev ?? []).flatMap(r => (r.id !== row.id ? [r] : status === 'review' ? [next] : [])))
    setNotes(prev => { const { [row.id]: _x, ...rest } = prev; void _x; return rest })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-4">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">要確認一覧（法改正）</h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
          法令基準日
          <input type="date" value={baseDate} onChange={e => setBaseDate(e.target.value)} className="border rounded px-2 py-1" />
          <button onClick={saveBaseDate} className="px-3 py-1 rounded border border-indigo-600 text-indigo-700">保存</button>
          {baseDateMsg && <span className="w-full text-xs text-gray-500">{baseDateMsg}</span>}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {rows === null && !error && <p className="text-sm text-gray-500">読み込み中…</p>}
        {rows !== null && rows.length === 0 && <p className="text-sm text-gray-600">確認待ちの肢はありません。</p>}

        {groups.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">年度・科目（未確認 / 要確認）。確認が済むまで、これらの肢は復習・集計に入りません。</p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setFilter(null)}
                className={`px-2 py-1 rounded border text-xs ${filter === null ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}
              >
                すべて（{rows?.length ?? 0}）
              </button>
              {groups.map(g => {
                const active = filter?.year === g.year && filter.subject === g.subject
                return (
                  <button
                    key={`${g.year}-${g.subject}`}
                    onClick={() => setFilter({ year: g.year, subject: g.subject })}
                    className={`px-2 py-1 rounded border text-xs ${active ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}
                  >
                    {g.year} {g.subject}（{g.unchecked} / {g.review}）
                  </button>
                )
              })}
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={onlyReview} onChange={e => setOnlyReview(e.target.checked)} />
              要確認（review）だけ
            </label>
          </div>
        )}

        <ul className="space-y-3">
          {shown.map(r => (
            <li key={r.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-gray-700">{r.id}</span>
                <span className={`px-1.5 rounded ${r.law_status === 'review' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                  {lawStatusLabel(r.law_status)}
                </span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.statement}</p>
              {r.law_note && <p className="text-xs text-gray-500 whitespace-pre-wrap border-l-2 pl-2">{r.law_note}</p>}
              <input
                value={notes[r.id] ?? ''}
                onChange={e => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                placeholder="根拠（条文・2027年版の教材の該当箇所など。追記される）"
                className="w-full border rounded px-2 py-1 text-sm"
              />
              <div className="flex gap-2">
                {LAW_DECISIONS.map(s => (
                  <button
                    key={s}
                    disabled={saving === r.id}
                    onClick={() => void decide(r, s)}
                    className="flex-1 py-1 rounded border text-sm text-gray-700 disabled:opacity-40"
                  >
                    {lawStatusLabel(s)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
