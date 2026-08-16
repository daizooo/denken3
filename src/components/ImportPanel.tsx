import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ASSET_MAP, BUCKET, chapterOf, storagePath, defaultAnswerXPct } from '../lib/assets'
import { DEFAULT_EXAM_ID, subjectDefsOf } from '../data/registry'
import { legacyPaperImagePath, paperImagePath } from '../lib/mock'
import type { PaperDefinition, PaperQuestion } from '../domain/types'

// 一度きりの取り込みツール。
// GoogleDriveから各単元フォルダの画像をローカルへ落とし、ここへドラッグするだけ。
// ログイン中の本人セッションで非公開ストレージへ直接アップロードするため、鍵の受け渡しは不要。
// 「分野別」＝ファイル名から問題へ自動紐付け（denken_question_assets に登録）。
// 「年度別」＝選択した回のフォルダへファイル名そのままアップロード（CBT模試・§7.4(4)）。
// ペーパーの一意キー（科目跨ぎで paperId が重複するため subjectId で修飾する）。
// 例: 理論と電力の 'r7-2' を区別するため 'riron/r7-2' / 'denryoku/r7-2' とする。
const paperKey = (p: PaperDefinition) => `${p.subjectId}/${p.id}`

export default function ImportPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [mode, setMode] = useState<'bunya' | 'nendo'>('bunya')
  // 年度別モードで選択中のペーパー。科目別に一覧を出し、subjectId+paperId の複合キーで保持する
  // （id だけだと科目跨ぎで衝突し、理論のペーパーに固定されてしまう）。
  const subjectDefs = useMemo(() => subjectDefsOf(DEFAULT_EXAM_ID), [])
  const [paperSel, setPaperSel] = useState<string>(() => {
    const first = subjectDefs.flatMap(s => s.papers ?? [])[0]
    return first ? paperKey(first) : ''
  })
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // 年度別: 各ペーパーへ既に画像がアップロード済みか（paperKey → 保存枚数）。
  // どの年度が済んでいてどれが未着手か一覧で分かるようにするため、Storageの実ファイルを数える。
  const [uploadedCounts, setUploadedCounts] = useState<Record<string, number>>({})
  const [statusLoading, setStatusLoading] = useState(false)

  const knownFiles = useMemo(() => Object.keys(ASSET_MAP).length, [])
  const add = (m: string) => setLog(l => [...l, m])

  // 全ペーパーのアップロード済み枚数をStorageから集計する。
  // 科目ごとに papers/{subjectId} を一覧し、各回フォルダ配下の実ファイル数を数える
  // （フォルダが無い＝未アップロードなので 0 として扱う）。
  const refreshStatus = useCallback(async () => {
    setStatusLoading(true)
    const counts: Record<string, number> = {}
    for (const s of subjectDefs) {
      for (const p of s.papers ?? []) {
        const prefix = paperImagePath(userId, s.id, p.id, '').replace(/\/$/, '')
        const { data } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 })
        // フォルダ以外の実ファイル（id !== null）のみを数える。
        let n = (data ?? []).filter(e => e.id !== null).length
        // 新パスに何も無い場合は、subjectId 導入前の旧パス（理論のみで運用していた頃の
        // 格納先）も確認する。ここを見ないと、表示側（PaperImage）は既に旧パスへ
        // フォールバックして正しく画像を出せているのに、この一覧だけが
        // 「未アップロード」と誤表示してしまう（理論の既存回で発生していた不整合）。
        if (n === 0) {
          const legacyPrefix = legacyPaperImagePath(userId, p.id, '').replace(/\/$/, '')
          const { data: legacyData } = await supabase.storage.from(BUCKET).list(legacyPrefix, { limit: 1000 })
          n = (legacyData ?? []).filter(e => e.id !== null).length
        }
        counts[paperKey(p)] = n
      }
    }
    setUploadedCounts(counts)
    setStatusLoading(false)
  }, [subjectDefs, userId])

  // パネルを開いた時と、年度別モードへ切り替えた時に最新の状況を取得する。
  useEffect(() => {
    if (mode === 'nendo') void refreshStatus()
  }, [mode, refreshStatus])

  // 年度別: 選択中ペーパーの想定ファイル名（imageFile）→ 対応する問題。
  // 番号(問N)からの逆引き用マップも用意する（GoogleDriveの元ファイル名対応・下記 resolvePaperQuestion）。
  const paper = useMemo(
    () => subjectDefs.flatMap(s => s.papers ?? []).find(p => paperKey(p) === paperSel),
    [subjectDefs, paperSel],
  )
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

  // 年度別ペーパーの画像を {user}/papers/{subjectId}/{paperId}/{filename} へアップロードし、
  // 単体復習（既存 denken_question_assets 基盤の再利用・§11.2）用にも登録する。
  // 画像は物理クロップなし（問題→解説→解答が縦に並ぶ1問1枚）。CBT解答中は answerYPct で下部をマスクする。
  // 保存先ファイル名はペーパー定義上の正規名（imageFile）に統一する（元ファイル名が別でも表示側と一致させるため）。
  async function handlePaperFiles(fileList: FileList | null) {
    if (!fileList || busy || !paper) return
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
    // 途中で例外が飛んでも busy を必ず false へ戻す（さもないと以降のアップロードが
    // 「取り込み中」のまま二度と開始できなくなる＝別の年度を選んでも反応しない不具合になる）。
    try {
      for (const { file: f, q } of targets) {
        const targetName = q?.imageFile ?? f.name
        const path = paperImagePath(userId, paper.subjectId, paper.id, targetName)
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
    } catch (e) {
      add(`✗ 取り込み中にエラーが発生しました: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
      // アップロード結果を状況表示（済/未の一覧・選択中の枚数）へ即時反映する。
      void refreshStatus()
    }
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

    // 年度別と同様、例外時も busy を必ず戻して次の取り込みを可能にする。
    try {
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
          // 解答マスクの横位置。1枚ごとに明示（B問題の(a)(b)分割・問題丸ごと/解答丸ごとページに対応）。
          answer_x_pct: defaultAnswerXPct(r),
          answer_y_pct: r.answerYPct ?? 100,
          // 右ページ上部が問題の続きの見開き（解答は途中から）／2問同居の上下境界。
          answer_right_y_pct: r.answerRightYPct ?? 0,
          region_y_pct: r.regionYPct ?? 50,
        }))
        const ins = await supabase
          .from('denken_question_assets')
          .upsert(insertRows, { onConflict: 'user_id,question_id,storage_path,sort' })
        if (ins.error) { add(`✗ ${f.name} 登録失敗: ${ins.error.message}`); failed++ }
        else rows += insertRows.length

        done++; setProgress({ done, total: targets.length })
      }
      add(`完了: 画像 ${uploaded} 枚アップロード / 問題 ${rows} 件登録${failed ? ` / 失敗 ${failed}` : ''}${skipped ? ` / 対象外スキップ ${skipped}` : ''}`)
    } catch (e) {
      add(`✗ 取り込み中にエラーが発生しました: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
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
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">取り込む回を選択</p>
                <button
                  type="button"
                  onClick={() => void refreshStatus()}
                  disabled={statusLoading}
                  className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-300"
                >{statusLoading ? '確認中…' : '状況を更新'}</button>
              </div>
              {/* 科目ごとにグループ化して並べる。同じ回名（例: 令和7年度 下期）が科目を跨いで並ぶため、
                  科目見出し（理論／電力／機械／法規）で区別できるようにする。
                  各回の頭に ✅（アップ済み）/ ⬜（未アップ）を付け、どの年度が済んでいるか一目で分かるようにする。 */}
              <select
                value={paperSel}
                // 年度を切り替えたら前回の完了ログ・進捗バーを消す
                // （残っていると「まだ処理中では」と誤解され、次の取り込みが進んでいないように見えるため）。
                onChange={e => { setPaperSel(e.target.value); setLog([]); setProgress(null) }}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                {subjectDefs.map(s => (s.papers && s.papers.length > 0) && (
                  <optgroup key={s.id} label={s.name}>
                    {s.papers.map(p => {
                      const n = uploadedCounts[paperKey(p)] ?? 0
                      return (
                        <option key={paperKey(p)} value={paperKey(p)}>
                          {n > 0 ? '✅' : '⬜'} {p.name}（{p.id}）{p.draft ? ' ※雛形' : ''}{n > 0 ? ` ・${n}枚` : ''}
                        </option>
                      )
                    })}
                  </optgroup>
                ))}
              </select>
              {paper && (() => {
                const uploaded = uploadedCounts[paperKey(paper)] ?? 0
                const expected = paperFiles.size
                const complete = expected > 0 && uploaded >= expected
                return (
                  <p className="text-xs text-gray-400">
                    取り込み先: {subjectDefs.find(s => s.id === paper.subjectId)?.name ?? paper.subjectId} ／ {paper.name}
                    {expected > 0 && ` ・想定ファイル数 ${expected} 枚`}
                    <br />
                    <span className={complete ? 'text-green-600 font-medium' : uploaded > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>
                      {statusLoading
                        ? 'アップロード状況を確認中…'
                        : uploaded === 0
                          ? '未アップロード'
                          : complete
                            ? `アップロード済み（${uploaded}枚）`
                            : `一部のみ（${uploaded}${expected > 0 ? ` / ${expected}` : ''}枚）`}
                    </span>
                  </p>
                )
              })()}
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
              // 取り込み後に value を空へ戻す。こうしないと同じファイルを選び直しても
              // onChange が発火せず、別の年度で再取り込みできなくなる。
              onChange={e => { void (mode === 'bunya' ? handleFiles : handlePaperFiles)(e.target.files); e.target.value = '' }}
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
