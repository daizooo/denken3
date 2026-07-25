import { useMemo, useRef, useState } from 'react'
import { X, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ASSET_MAP, BUCKET, chapterOf, storagePath } from '../lib/assets'
import { PAPERS } from '../data/registry'
import { paperImagePath } from '../lib/mock'
import type { PaperQuestion } from '../domain/types'

// 一度きりの取り込みツール。
// GoogleDriveから各単元フォルダの画像をローカルへ落とし、ここへドラッグするだけ。
// ログイン中の本人セッションで非公開ストレージへ直接アップロードするため、鍵の受け渡しは不要。
// 「分野別」＝ファイル名から問題へ自動紐付け（denken_question_assets に登録）。
// 「年度別」＝選択した回のフォルダへファイル名そのままアップロード（CBT模試・§7.4(4)）。
export default function ImportPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [mode, setMode] = useState<'bunya' | 'nendo'>('bunya')
  const [paperId, setPaperId] = useState<string>(PAPERS[0]?.id ?? '')
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const knownFiles = useMemo(() => Object.keys(ASSET_MAP).length, [])
  const add = (m: string) => setLog(l => [...l, m])

  // 年度別: 選択中ペーパーの想定ファイル名（imageFile）→ 対応する問題。
  // 番号(問N)からの逆引き用マップも用意する（GoogleDriveの元ファイル名対応・下記 resolvePaperQuestion）。
  const paper = useMemo(() => PAPERS.find(x => x.id === paperId), [paperId])
  const paperFiles = useMemo(() => {
    const m = new Map<string, PaperQuestion>()
    for (const q of paper?.questions ?? []) m.set(q.imageFile, q)
    return m
  }, [paper])
  const paperByNumber = useMemo(() => {
    const m = new Map<number, PaperQuestion>()
    for (const q of paper?.questions ?? []) m.set(q.number, q)
    return m
  }, [paper])

  // ファイル名から問題を特定する。まず imageFile（a01.png 等）の完全一致を試し、
  // 見つからなければファイル名中の「問N」表記、それも無ければ拡張子直前の数字から逆引きする
  // （電験王キャプチャをGoogleDrive経由でそのまま持ってきた場合の元ファイル名に対応するため）。
  function resolvePaperQuestion(filename: string): PaperQuestion | undefined {
    const exact = paperFiles.get(filename)
    if (exact) return exact
    const m = filename.match(/問\s*(\d+)/) ?? filename.match(/(\d+)(?=\.[^.]+$)/)
    return m ? paperByNumber.get(Number(m[1])) : undefined
  }

  // 年度別ペーパーの画像を {user}/papers/{paperId}/{filename} へアップロードし、
  // 単体復習（既存 denken_question_assets 基盤の再利用・§11.2）用にも登録する。
  // 画像は物理クロップなし（問題→解説→解答が縦に並ぶ1問1枚）。CBT解答中は answerYPct で下部をマスクする。
  // 保存先ファイル名はペーパー定義上の正規名（imageFile）に統一する（元ファイル名が別でも表示側と一致させるため）。
  async function handlePaperFiles(fileList: FileList | null) {
    if (!fileList || busy || !paperId) return
    const all = Array.from(fileList)
    const resolved = all.map(f => ({ file: f, q: resolvePaperQuestion(f.name) }))
    // ペーパー定義に紐付くファイルのみ対象（想定外の取り違え防止）。定義が無い（雛形前）なら全て受け入れる。
    const targets = paperFiles.size > 0 ? resolved.filter(r => r.q) : resolved
    const skipped = all.length - targets.length
    if (targets.length === 0) {
      setLog([`対象の画像が見つかりませんでした（${all.length}件はこの回の定義に無いためスキップ）。`])
      return
    }
    setBusy(true); setLog([]); setProgress({ done: 0, total: targets.length })
    let uploaded = 0, rows = 0, failed = 0, done = 0
    for (const { file: f, q } of targets) {
      const targetName = q?.imageFile ?? f.name
      const path = paperImagePath(userId, paperId, targetName)
      const up = await supabase.storage.from(BUCKET).upload(
        path, f, { upsert: true, contentType: f.type || 'image/png' },
      )
      if (up.error) {
        add(`✗ ${f.name}: ${up.error.message}`); failed++
        done++; setProgress({ done, total: targets.length }); continue
      }
      uploaded++
      if (targetName !== f.name) add(`${f.name} → ${targetName} として保存`)

      if (q) {
        const ins = await supabase.from('denken_question_assets').upsert(
          { user_id: userId, question_id: q.id, storage_path: path, region: null, sort: 0, answer_x_pct: 100, answer_y_pct: q.answerYPct },
          { onConflict: 'user_id,question_id,storage_path,sort' },
        )
        if (ins.error) { add(`✗ ${f.name} 登録失敗: ${ins.error.message}`); failed++ }
        else rows++
      }
      done++; setProgress({ done, total: targets.length })
    }
    add(`完了: 画像 ${uploaded} 枚アップロード / 単体復習用登録 ${rows} 件${failed ? ` / 失敗 ${failed}` : ''}${skipped ? ` / 対象外スキップ ${skipped}` : ''}`)
    setBusy(false)
  }

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
          {/* 取り込みモード */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {(['bunya', 'nendo'] as const).map(m => (
              <button key={m}
                onClick={() => { setMode(m); setLog([]); setProgress(null) }}
                className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                  mode === m ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >{m === 'bunya' ? '分野別' : '年度別（CBT模試）'}</button>
            ))}
          </div>

          {mode === 'bunya' ? (
            <p className="text-xs text-gray-500 leading-relaxed">
              GoogleDriveの各単元フォルダの画像をパソコンに保存し、下のエリアへドラッグ（または選択）してください。
              ファイル名から自動で問題に紐付け、あなた専用の非公開ストレージへ保存します。
              捨て問など対象外のファイルは自動でスキップされます。
              <br />
              <span className="text-gray-400">現在マッピング済み: {knownFiles} ファイル（直流回路・単相交流・過渡現象・三相交流・静電気・電磁気・電気計測・電子理論・電子回路）</span>
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 leading-relaxed">
                電験王ページを1問1枚でキャプチャした元画像（問題・ワンポイント解説・解答が縦に並んだまま）を
                回ごとに取り込みます。ファイル名は各回の定義（例: <code className="text-gray-600">a01.png</code>）に合わせるのが確実ですが、
                「<code className="text-gray-600">…問1.png</code>」のように問題番号を含むファイル名（GoogleDriveの元ファイル名など）でも自動認識します。
              </p>
              <select
                value={paperId}
                onChange={e => setPaperId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                {PAPERS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}（{p.id}）{p.draft ? ' ※雛形' : ''}</option>
                ))}
              </select>
              {paperFiles.size > 0 && (
                <p className="text-xs text-gray-400">この回の想定ファイル数: {paperFiles.size} 枚</p>
              )}
            </div>
          )}

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); (mode === 'bunya' ? handleFiles : handlePaperFiles)(e.dataTransfer.files) }}
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
              onChange={e => (mode === 'bunya' ? handleFiles : handlePaperFiles)(e.target.files)}
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
