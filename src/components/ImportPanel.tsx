import { useMemo, useRef, useState } from 'react'
import { X, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ASSET_MAP, BUCKET, chapterOf, storagePath } from '../lib/assets'

// 一度きりの取り込みツール。
// GoogleDriveから各単元フォルダの画像をローカルへ落とし、ここへドラッグするだけ。
// ログイン中の本人セッションで非公開ストレージへ直接アップロードするため、鍵の受け渡しは不要。
export default function ImportPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const knownFiles = useMemo(() => Object.keys(ASSET_MAP).length, [])
  const add = (m: string) => setLog(l => [...l, m])

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || busy) return
    const all = Array.from(fileList)
    const targets = all.filter(f => ASSET_MAP[f.name])
    const skipped = all.length - targets.length
    if (targets.length === 0) {
      setLog([`対象の画像が見つかりませんでした（${all.length}件は未登録/捨て問のためスキップ）。`])
      return
    }
    setBusy(true); setLog([]); setProgress({ done: 0, total: targets.length })
    let uploaded = 0, rows = 0, failed = 0, done = 0

    for (const f of targets) {
      const refs = ASSET_MAP[f.name]
      const chapter = chapterOf(refs[0].questionId)
      const path = storagePath(userId, chapter, f.name)

      const up = await supabase.storage.from(BUCKET).upload(path, f, {
        upsert: true,
        contentType: f.type || 'image/png',
      })
      if (up.error) {
        add(`✗ ${f.name}: ${up.error.message}`); failed++
        done++; setProgress({ done, total: targets.length }); continue
      }
      uploaded++

      const insertRows = refs.map(r => ({
        user_id: userId,
        question_id: r.questionId,
        storage_path: path,
        region: r.region,
        sort: r.sort,
        answer_y_pct: r.answerYPct ?? 100,
      }))
      const ins = await supabase
        .from('denken_question_assets')
        .upsert(insertRows, { onConflict: 'user_id,question_id,storage_path,sort' })
      if (ins.error) { add(`✗ ${f.name} 登録失敗: ${ins.error.message}`); failed++ }
      else rows += insertRows.length

      done++; setProgress({ done, total: targets.length })
    }

    add(`完了: 画像 ${uploaded} 枚アップロード / 問題 ${rows} 件登録${failed ? ` / 失敗 ${failed}` : ''}${skipped ? ` / 対象外スキップ ${skipped}` : ''}`)
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
          <Upload size={18} className="text-blue-600" />
          <p className="font-bold text-gray-800 text-sm flex-1">問題画像の取り込み</p>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            GoogleDriveの各単元フォルダの画像をパソコンに保存し、下のエリアへドラッグ（または選択）してください。
            ファイル名から自動で問題に紐付け、あなた専用の非公開ストレージへ保存します。
            捨て問など対象外のファイルは自動でスキップされます。
            <br />
            <span className="text-gray-400">現在マッピング済み: {knownFiles} ファイル（直流回路・単相交流・過渡現象）</span>
          </p>

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              busy ? 'border-gray-200 bg-gray-50' : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50/40'
            }`}
          >
            <Upload size={24} className="mx-auto text-blue-400 mb-2" />
            <p className="text-sm text-gray-600">{busy ? '取り込み中...' : '画像をドラッグ、またはタップして選択'}</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              multiple
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
          </div>

          {progress && (
            <div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{progress.done} / {progress.total}</p>
            </div>
          )}

          {log.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-auto space-y-0.5">
              {log.map((l, i) => (
                <p key={i} className={`text-xs ${l.startsWith('✗') ? 'text-red-500' : 'text-gray-600'}`}>{l}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
