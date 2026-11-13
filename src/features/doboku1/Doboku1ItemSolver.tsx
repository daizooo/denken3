// 1級土木の解答画面（共通画面の「問題を見る／解く」から開く。AnyItemSolver が D1_ の ID をここへ振り分ける）。
// 枠と props は社労士の ItemSolver と同じ。中身は四肢択一（Doboku1Solver）で、記録は呼び出し側
// （App の updateStatus = 社労士と同じ reviews / FSRS の経路）に渡す。
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Status } from '../../domain/types'
import type { Attempt } from '../../lib/attempt'
import type { DbkQuestionRow } from '../../lib/doboku1/types'
import { statusOfAttempt } from '../../lib/doboku1/record'
import { supabase } from '../../lib/supabase'
import Doboku1Solver from './Doboku1Solver'
import { d1PrimerOf } from '../../data/doboku1/primer/index'
import Doboku1PrimerSolver from './Doboku1PrimerSolver'
import PrimerNoteView from '../kenkei2/PrimerNoteView'

const COLS = 'id, year, paper, q_no, group_label, required, category, topic, kind, direction, stem, statements, choice_header, choices, correct, has_figure, figure_path, explain, explain_verified'

export default function Doboku1ItemSolver({ itemId, title, userId, onRecord, onUndoRecord, onClose }: {
  itemId: string
  title: string
  userId: string
  onRecord: (status: Status, attempt: Attempt) => void
  onUndoRecord: () => void
  onClose: () => void
}) {
  const [q, setQ] = useState<DbkQuestionRow | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  // 入門の○×（D1_P_）はリポジトリのデータで解く（DB を読まない。docs/design/doboku1-primer.md）。
  const primer = d1PrimerOf(itemId)

  useEffect(() => {
    if (d1PrimerOf(itemId)) return
    let alive = true
    supabase.from('dbk_questions').select(COLS).eq('user_id', userId).eq('id', itemId).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data) { setState('error'); return }
        setQ(data as DbkQuestionRow)
        setState('ok')
      })
    return () => { alive = false }
  }, [itemId, userId])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-4">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">{title}</h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>
        {primer ? (
          <div className="space-y-4">
            <PrimerNoteView key={primer.topic.id} topic={primer.topic} readKey="d1:primer:read" doneLabel="読んだ → 下の○×を解く" />
            <Doboku1PrimerSolver
              key={itemId}
              heading={`入門 ${primer.topic.name} (${primer.n})`}
              quiz={primer.quiz}
              onRecord={a => onRecord(statusOfAttempt(a), a)}
              onUndo={onUndoRecord}
              onClose={onClose}
            />
          </div>
        ) : state === 'loading' ? (
          <p className="text-sm text-gray-500">本文を読み込み中…</p>
        ) : state === 'error' || !q ? (
          <p className="text-sm text-gray-600">
            この問題を読み込めませんでした。
            {typeof navigator !== 'undefined' && !navigator.onLine && ' オンラインに戻ってから開き直してください。'}
          </p>
        ) : (
          <Doboku1Solver
            userId={userId}
            q={q}
            hasNext={false}
            onRecord={a => onRecord(statusOfAttempt(a), a)}
            onUndo={onUndoRecord}
            onNext={onClose}
          />
        )}
      </div>
    </div>
  )
}
