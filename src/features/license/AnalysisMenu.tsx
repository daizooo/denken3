// 復習タブの「分析・模試」メニュー。頻度の低い入口（本番形式模試・進級判定・足切り・要確認一覧）を1つに畳む。
// 毎日使う一括コピー・一括記録（BatchButtons）は畳まず、App 側でこの上に置く。
// 要確認一覧は、確認待ち（unchecked / review）の肢があるときだけ出す。件数は閉じていてもバッジで分かる。
import { useEffect, useState, type ReactNode } from 'react'
import { BarChart3, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PENDING_LAW_STATUSES } from '../../lib/license/lawStatus'
import LawReviewButton from './LawReviewButton'

export default function AnalysisMenu({ userId, children }: { userId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  // null: 取得中。失敗したときは null のまま（要確認一覧への入口は出す）。
  const [pending, setPending] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    supabase.from('lic_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('law_status', [...PENDING_LAW_STATUSES])
      .then(({ count, error }) => { if (alive && !error) setPending(count ?? 0) })
    return () => { alive = false }
  }, [userId])

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border bg-white text-sm text-gray-700"
      >
        <BarChart3 size={16} /> 分析・模試
        {pending != null && pending > 0 && (
          <span className="ml-1 px-1.5 rounded-full bg-amber-100 text-amber-800 text-xs">要確認 {pending}</span>
        )}
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2">
          {(pending == null || pending > 0) && <LawReviewButton userId={userId} />}
          {children}
        </div>
      )}
    </>
  )
}
