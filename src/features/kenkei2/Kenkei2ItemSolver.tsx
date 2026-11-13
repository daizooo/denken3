// 2級建設業経理士の解答画面（共通画面の「問題を見る／解く」から開く。AnyItemSolver が K2_ の ID をここへ振り分ける）。
// 枠と props は社労士の ItemSolver・1級土木の Doboku1ItemSolver と同じ。記録は呼び出し側
// （App の updateStatus = 同じ reviews / FSRS の経路）に渡す。
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Status } from '../../domain/types'
import type { Attempt } from '../../lib/attempt'
import type { Kk2Row } from '../../lib/kenkei2/cards'
import { statusOfAttempt } from '../../lib/kenkei2/record'
import { supabase } from '../../lib/supabase'
import Kenkei2Solver from './Kenkei2Solver'
import { primerOf, primerRowOf } from '../../data/kenkei2/primer/index'

const COLS = 'id, exam_no, part, sub, form_kind, points, stem, frame, key'

export default function Kenkei2ItemSolver({ itemId, title, userId, onRecord, onUndoRecord, onClose }: {
  itemId: string
  title: string
  userId: string
  onRecord: (status: Status, attempt: Attempt) => void
  onUndoRecord: () => void
  onClose: () => void
}) {
  const [row, setRow] = useState<Kk2Row | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  // 入門ドリル（K2_P_）はリポジトリのデータから作る（DB を読まない）。
  const primer = primerOf(itemId)

  useEffect(() => {
    const local = primerRowOf(itemId)
    if (local) { setRow(local); setState('ok'); return }
    let alive = true
    supabase.from('kk2_questions').select(COLS).eq('user_id', userId).eq('id', itemId).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data) { setState('error'); return }
        setRow(data as Kk2Row)
        setState('ok')
      })
    return () => { alive = false }
  }, [itemId, userId])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-5xl sm:rounded-2xl">
        <div className="mb-3 flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">{title}</h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>
        {state === 'loading' ? (
          <p className="text-sm text-gray-500">問題を読み込み中…</p>
        ) : state === 'error' || !row ? (
          <p className="text-sm text-gray-600">
            この問題を読み込めませんでした（まだ取り込まれていない回の可能性があります）。
            {typeof navigator !== 'undefined' && !navigator.onLine && ' オンラインに戻ってから開き直してください。'}
          </p>
        ) : (
          <div className="space-y-4">
            <Kenkei2Solver
              userId={userId}
              row={row}
              heading={primer ? `入門ドリル ${primer.topic.name} (${primer.n})` : undefined}
              explain={primer?.drill.explain}
              onRecord={a => onRecord(statusOfAttempt(a), a)}
              onUndo={onUndoRecord}
              onClose={onClose}
            />
          </div>
        )}
      </div>
    </div>
  )
}
