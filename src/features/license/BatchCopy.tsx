// 一括コピー — licensehub-expansion.md §6.3。
//
// 今日の復習キュー（表示順）から出題できる肢を N 件（既定10、5〜30）選び、番号付きの
// 1つのテキストにしてコピーする。**答え・解説は含めない**（batchText.ts）。
// コピーした時点で組を localStorage に保存し、BatchGrade に引き継ぐ（batchSession.ts）。
import { useMemo, useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { FETCH_CHUNK } from '../../lib/license/itemBody'
import { pickBatch } from '../../lib/license/batchGrade'
import {
  BATCH_DEFAULT, BATCH_MAX, BATCH_MIN, clampBatchSize, formatBatchCreatedAt, formatBatchForClipboard,
} from '../../lib/license/batchText'
import { browserStorage, newBatchSession, saveBatchSession } from '../../lib/license/batchSession'
import { useItemBodies } from './useItemBodies'

export default function BatchCopy({
  userId, examId, queueIds, onClose, onGoGrade,
}: {
  userId: string
  examId: string
  /** 今日の復習キュー（表示順）。 */
  queueIds: string[]
  onClose: () => void
  onGoGrade: () => void
}) {
  // 開いた時点のキューで固定する（記録が進んでキューが変わっても、選び直さない）。
  // 本文は先頭から FETCH_CHUNK 件だけ取る（30肢を選ぶには十分）。
  const [candidates] = useState(() => queueIds.slice(0, FETCH_CHUNK))
  const { bodies, loading } = useItemBodies(candidates, userId)
  const [size, setSize] = useState(BATCH_DEFAULT)
  const [done, setDone] = useState<{ count: number; text: string; copied: boolean } | null>(null)

  const picked = useMemo(() => pickBatch(candidates, bodies, size), [candidates, bodies, size])

  const copy = async () => {
    if (picked.length === 0) return
    const session = newBatchSession(picked, userId, examId, new Date())
    const text = formatBatchForClipboard(picked.map(id => bodies[id]), formatBatchCreatedAt(session.createdAt))
    // 組はクリップボードの成否に関わらず保存する（手でコピーする場合も同じ組で記録できるように）。
    saveBatchSession(browserStorage(), session)
    let copied = false
    try {
      await navigator.clipboard.writeText(text)
      copied = true
    } catch {
      // クリップボードが使えない環境では、下のテキスト欄から手でコピーしてもらう
    }
    setDone({ count: picked.length, text, copied })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-4">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-sm font-bold text-gray-700">一括コピー（今日の復習から）</h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
        </div>

        {!done ? (
          <>
            <label className="flex items-center gap-3 text-sm text-gray-700">
              肢の数
              <input
                type="range" min={BATCH_MIN} max={BATCH_MAX} step={1} value={size}
                onChange={e => setSize(clampBatchSize(Number(e.target.value)))}
                className="flex-1"
              />
              <span className="w-10 text-right font-bold">{size}</span>
            </label>

            {loading ? (
              <p className="text-sm text-gray-500">本文を読み込み中…</p>
            ) : picked.length === 0 ? (
              <p className="text-sm text-gray-600">
                コピーできる肢がありません（今日の復習が無い、または本文が未取得・出題対象外）。
                {typeof navigator !== 'undefined' && !navigator.onLine && ' オンラインに戻ってから開き直してください。'}
              </p>
            ) : (
              <p className="text-sm text-gray-700">
                {picked.length < size
                  ? `出題できる肢が ${picked.length} 件だけでした。${picked.length} 肢をコピーします。`
                  : `${picked.length} 肢をコピーします。`}
                <span className="block text-xs text-gray-500 mt-1">答え・解説は含めません。解き終わったら「一括記録」で番号ごとに入力します。</span>
              </p>
            )}

            <button
              onClick={copy}
              disabled={loading || picked.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40"
            >
              <Copy size={16} /> テキストをコピー
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-gray-800">
              {done.copied && <Check size={16} className="text-green-600" />}
              {done.copied
                ? `${done.count} 肢をコピーしました。`
                : `${done.count} 肢のテキストを作りました。クリップボードが使えないため、下の欄から手でコピーしてください。`}
            </p>
            {!done.copied && (
              <textarea readOnly value={done.text} className="w-full h-40 text-xs border rounded p-2" onFocus={e => e.currentTarget.select()} />
            )}
            <p className="text-xs text-gray-500">
              この組は端末に保存しました。ブラウザを閉じても「一括記録」から同じ組で記録できます。
            </p>
            <button onClick={onGoGrade} className="w-full py-2 rounded-lg border border-indigo-600 text-indigo-700 font-bold">
              一括記録へ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
