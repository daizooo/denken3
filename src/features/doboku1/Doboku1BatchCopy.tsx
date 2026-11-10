// 1級土木の一括コピー（会社学習用。社労士の BatchCopy と同じ運用）。
// 今の一覧（復習 or 分野）の表示順から、図の無い問を N 問選んで番号付きの1テキストにする。正答・解説は含めない。
// コピーした時点で組を localStorage に保存し、Doboku1BatchGrade に引き継ぐ。
import { useMemo, useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import type { DbkQuestionRow } from '../../lib/doboku1/types'
import { browserStorage, newBatchSession } from '../../lib/license/batchSession'
import { formatBatchCreatedAt } from '../../lib/license/batchText'
import { DOBOKU1_EXAM_ID } from '../../lib/doboku1/record'
import {
  DBK_BATCH_DEFAULT, DBK_BATCH_MAX, DBK_BATCH_MIN, clampDbkBatchSize, formatDbkBatch, pickDbkBatch, saveDbkBatch,
} from '../../lib/doboku1/copyText'

export default function Doboku1BatchCopy({ userId, label, list, onClose, onGoGrade }: {
  userId: string
  label: string                 // 例: '復習' '土工'
  list: DbkQuestionRow[]        // 今の一覧（表示順）
  onClose: () => void
  onGoGrade: () => void
}) {
  const [candidates] = useState(list)   // 開いた時点で固定
  const [size, setSize] = useState(DBK_BATCH_DEFAULT)
  const [done, setDone] = useState<{ count: number; text: string; copied: boolean } | null>(null)
  const picked = useMemo(() => pickDbkBatch(candidates, size), [candidates, size])
  const figureN = candidates.filter(q => q.has_figure).length

  const copy = async () => {
    if (picked.length === 0) return
    const session = newBatchSession(picked, userId, DOBOKU1_EXAM_ID, new Date())
    const byId = new Map(candidates.map(q => [q.id, q]))
    const text = formatDbkBatch(picked.map(id => byId.get(id)!), formatBatchCreatedAt(session.createdAt))
    saveDbkBatch(browserStorage(), session)   // クリップボードの成否に関わらず保存
    let copied = false
    try { await navigator.clipboard.writeText(text); copied = true } catch { /* 下の欄から手でコピー */ }
    setDone({ count: picked.length, text, copied })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center">
      <div className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-xl sm:rounded-2xl">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">一括コピー（{label}から）</h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>
        {!done ? (
          <>
            <label className="flex items-center gap-3 text-sm text-gray-700">
              問題数
              <input type="range" min={DBK_BATCH_MIN} max={DBK_BATCH_MAX} step={1} value={size}
                onChange={e => setSize(clampDbkBatchSize(Number(e.target.value)))} className="flex-1" />
              <span className="w-10 text-right font-bold">{size}</span>
            </label>
            {picked.length === 0 ? (
              <p className="text-sm text-gray-600">コピーできる問題がありません（一覧が空、または図のある問だけ）。</p>
            ) : (
              <p className="text-sm text-gray-700">
                {picked.length < size ? `コピーできる問題が ${picked.length} 問だけでした。` : `${picked.length} 問をコピーします。`}
                <span className="mt-1 block text-xs text-gray-500">
                  正答・解説は含めません。解き終わったら「一括記録」で番号ごとに入力します。
                  {figureN > 0 && ` 図のある問（${figureN}問）は文字にできないため除きます（アプリで解いてください）。`}
                </span>
              </p>
            )}
            <button onClick={copy} disabled={picked.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 py-2 font-bold text-white disabled:opacity-40">
              <Copy size={16} /> テキストをコピー
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-gray-800">
              {done.copied && <Check size={16} className="text-green-600" />}
              {done.copied ? `${done.count} 問をコピーしました。` : `${done.count} 問のテキストを作りました。下の欄から手でコピーしてください。`}
            </p>
            {!done.copied && (
              <textarea readOnly value={done.text} className="h-40 w-full rounded border p-2 text-xs" onFocus={e => e.currentTarget.select()} />
            )}
            <p className="text-xs text-gray-500">この組は端末に保存しました。ブラウザを閉じても「一括記録」から同じ組で記録できます。</p>
            <button onClick={onGoGrade} className="w-full rounded-lg border border-blue-700 py-2 font-bold text-blue-800">一括記録へ</button>
          </div>
        )}
      </div>
    </div>
  )
}
