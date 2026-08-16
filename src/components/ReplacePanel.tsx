import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ASSET_MAP, BUCKET, chapterOf, defaultAnswerXPct, signedUrl, storagePath, type AssetRef } from '../lib/assets'
import { chaptersOf, DEFAULT_EXAM_ID, subjectDefsOf } from '../data/registry'
import { legacyPaperImagePath, paperImagePath } from '../lib/mock'
import type { PaperDefinition } from '../domain/types'

// 「取り込み済みの1問だけ、画像を撮り直したので差し替えたい」ための導線
// （docs/data-correction-workflow.md §5-C ＝ 課題④の解消）。
//
// 一括取り込み（ImportPanel の分野別／年度別）との違いは3点。
//  1. 対象を**ファイル名の自動判定ではなく明示選択**する。撮り直した画像の名前が
//     元と違っても（IMG_1234.png など）、選んだ問題の保存先へそのまま上書きできる。
//  2. アップロード前に**現在登録されている画像を表示**する。差し替え先を取り違えたまま
//     上書きしてしまう事故（元画像は手元にしか無い＝復旧できない）を防ぐ。
//  3. 既に行がある場合、`denken_question_assets` の**座標は書き換えない**。
//     座標はDBが唯一の正で、修正はSQLのUPDATE1行（§3・§5-A）。取り込み定義（TS）の
//     初期値で上書きしてしまうと、SQLで直した値が画像差し替えのたびに巻き戻る。
//     行が無いとき（未登録）だけ、取り込みと同じ既定値で登録する。
const paperKey = (p: PaperDefinition) => `${p.subjectId}/${p.id}`

// 差し替えの単位＝Storage上の画像1枚。分野別は見開き1枚に2問同居することがあるため、
// その画像に紐付く問題（AssetRef）をまとめて1候補として扱う。
interface BunyaTarget {
  filename: string
  refs: AssetRef[]
  label: string
}

// 選択された差し替え先。path へ上書きし、rowsIfMissing は未登録時のみ投入する。
interface Target {
  path: string
  legacyPath?: string
  questionIds: string[]
  caption: string
  rowsIfMissing: Record<string, unknown>[]
}

interface AssetRow {
  question_id: string
  storage_path: string
  sort: number
  region: string | null
  answer_x_pct: number
  answer_y_pct: number
  question_start_pct: number
  explanation_end_pct: number
}

export default function ReplacePanel({ userId }: { userId: string }) {
  const [kind, setKind] = useState<'bunya' | 'nendo'>('nendo')
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<File | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [current, setCurrent] = useState<{ url: string | null; fromLegacy: boolean; rows: AssetRow[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const add = (m: string) => setLog(l => [...l, m])

  // ---- 選択肢の組み立て（分野別）----
  // 問題番号・タイトルは章マスタから引く（question_id だけでは何の問題か分からないため）。
  const chapters = useMemo(() => chaptersOf(DEFAULT_EXAM_ID), [])
  const questionMeta = useMemo(() => {
    const m = new Map<string, { number: number; title: string }>()
    for (const c of chapters) for (const q of c.questions) m.set(q.id, { number: q.number, title: q.title })
    return m
  }, [chapters])

  // 章コード → その章に属する画像（ASSET_MAP の1エントリ＝1ファイル）。
  const bunyaByChapter = useMemo(() => {
    const m = new Map<string, BunyaTarget[]>()
    for (const [filename, refs] of Object.entries(ASSET_MAP)) {
      const ordered = [...refs].sort(
        (a, b) => (questionMeta.get(a.questionId)?.number ?? 0) - (questionMeta.get(b.questionId)?.number ?? 0),
      )
      const nums = ordered.map(r => questionMeta.get(r.questionId)?.number).filter((n): n is number => n != null)
      const title = questionMeta.get(ordered[0].questionId)?.title ?? ''
      const label = `${nums.length > 0 ? `問${nums.join('・')}` : ordered[0].questionId}`
        + `${ordered[0].sort > 0 ? '（続き）' : ''} ${title}`
      const code = chapterOf(ordered[0].questionId)
      const list = m.get(code) ?? []
      list.push({ filename, refs: ordered, label })
      m.set(code, list)
    }
    for (const list of m.values()) {
      list.sort((a, b) => {
        const na = questionMeta.get(a.refs[0].questionId)?.number ?? 0
        const nb = questionMeta.get(b.refs[0].questionId)?.number ?? 0
        return na - nb || a.refs[0].sort - b.refs[0].sort
      })
    }
    return m
  }, [questionMeta])

  // 画像が1枚でもある章だけを、章マスタの並び順で出す。
  const bunyaChapters = useMemo(
    () => chapters.filter(c => (bunyaByChapter.get(c.code)?.length ?? 0) > 0),
    [chapters, bunyaByChapter],
  )
  const [chapterCode, setChapterCode] = useState<string>(() => bunyaChapters[0]?.code ?? '')
  const bunyaTargets = useMemo(() => bunyaByChapter.get(chapterCode) ?? [], [bunyaByChapter, chapterCode])
  const [fileSel, setFileSel] = useState<string>(() => bunyaByChapter.get(bunyaChapters[0]?.code ?? '')?.[0]?.filename ?? '')

  // ---- 選択肢の組み立て（年度別）----
  const subjectDefs = useMemo(() => subjectDefsOf(DEFAULT_EXAM_ID), [])
  const papers = useMemo(() => subjectDefs.flatMap(s => s.papers ?? []), [subjectDefs])
  const [paperSel, setPaperSel] = useState<string>(() => (papers[0] ? paperKey(papers[0]) : ''))
  const paper = useMemo(() => papers.find(p => paperKey(p) === paperSel), [papers, paperSel])
  const [questionSel, setQuestionSel] = useState<string>(() => papers[0]?.questions[0]?.id ?? '')

  // 回を切り替えたら、その回の先頭の問題へ合わせる（前の回のIDが残ると対象が消える）。
  useEffect(() => {
    if (paper && !paper.questions.some(q => q.id === questionSel)) {
      setQuestionSel(paper.questions[0]?.id ?? '')
    }
  }, [paper, questionSel])

  // 章を切り替えたときも同様に先頭のファイルへ合わせる。
  useEffect(() => {
    if (bunyaTargets.length > 0 && !bunyaTargets.some(t => t.filename === fileSel)) {
      setFileSel(bunyaTargets[0].filename)
    }
  }, [bunyaTargets, fileSel])

  // ---- 差し替え先の解決 ----
  const target = useMemo<Target | null>(() => {
    if (kind === 'bunya') {
      const t = bunyaTargets.find(x => x.filename === fileSel)
      if (!t) return null
      const path = storagePath(userId, chapterOf(t.refs[0].questionId), t.filename)
      return {
        path,
        questionIds: t.refs.map(r => r.questionId),
        caption: `${chapters.find(c => c.code === chapterCode)?.name ?? chapterCode} ／ ${t.label}`,
        // 未登録時のみ使う既定値（ImportPanel の分野別取り込みと同一）。
        rowsIfMissing: t.refs.map(r => ({
          user_id: userId, question_id: r.questionId, storage_path: path, region: r.region, sort: r.sort,
          answer_x_pct: defaultAnswerXPct(r), answer_y_pct: r.answerYPct ?? 100,
          answer_right_y_pct: r.answerRightYPct ?? 0, region_y_pct: r.regionYPct ?? 50,
        })),
      }
    }
    const q = paper?.questions.find(x => x.id === questionSel)
    if (!paper || !q) return null
    const path = paperImagePath(userId, paper.subjectId, paper.id, q.imageFile)
    return {
      path,
      // 旧パス（subjectId 導入前の理論画像）に現物があることがある。現状確認のために参照する。
      legacyPath: legacyPaperImagePath(userId, paper.id, q.imageFile),
      questionIds: [q.id],
      caption: `${subjectDefs.find(s => s.id === paper.subjectId)?.name ?? paper.subjectId} ／ ${paper.name} ／ 問${q.number}`,
      // 未登録時のみ使う既定値（ImportPanel の年度別取り込みと同一）。
      rowsIfMissing: [{
        user_id: userId, question_id: q.id, storage_path: path, region: null, sort: 0, answer_x_pct: 100,
        question_start_pct: q.questionStartPct, answer_y_pct: q.answerYPct, explanation_end_pct: q.explanationEndPct,
      }],
    }
  }, [kind, bunyaTargets, fileSel, userId, chapters, chapterCode, paper, questionSel, subjectDefs])

  // ---- 現状（登録済み画像・座標）の取得 ----
  // 上書きは取り消せないので、対象を選んだ時点で「今そこに何が入っているか」を必ず見せる。
  const targetPath = target?.path
  const targetLegacy = target?.legacyPath
  const targetIds = target?.questionIds.join(',') ?? ''
  // 差し替え先に登録されている行。取得に失敗したら null を返す（＝「無い」と区別する。
  // 未確認を「行が無い」と誤認すると、下の runReplace が初期値を書き込んで
  // SQLで直した座標を巻き戻してしまうため）。
  const fetchRows = useCallback(async (): Promise<AssetRow[] | null> => {
    if (!targetPath) return []
    const ids = targetIds ? targetIds.split(',') : []
    const { data, error } = await supabase
      .from('denken_question_assets')
      .select('question_id, storage_path, sort, region, answer_x_pct, answer_y_pct, question_start_pct, explanation_end_pct')
      .eq('user_id', userId)
      .in('question_id', ids)
    if (error) return null
    return ((data ?? []) as AssetRow[])
      .filter(r => r.storage_path === targetPath || r.storage_path === targetLegacy)
      .sort((a, b) => a.sort - b.sort)
  }, [targetPath, targetLegacy, targetIds, userId])

  const loadCurrent = useCallback(async () => {
    if (!targetPath) { setCurrent(null); return }
    setLoading(true)
    const url = await signedUrl(targetPath).catch(() => null)
    // 新パスに現物が無いときだけ旧パスを見る（表示側 PaperImage と同じフォールバック順）。
    const legacyUrl = url || !targetLegacy ? null : await signedUrl(targetLegacy).catch(() => null)
    const rows = (await fetchRows()) ?? []
    setCurrent({
      // 署名URLはトークンが同じ秒内で一致し得るため、差し替え直後に古い画像がキャッシュから
      // 返らないようダミーのクエリを足してURLを必ず変える。
      url: url ? `${url}&cb=${Date.now()}` : legacyUrl,
      fromLegacy: !url && !!legacyUrl,
      rows,
    })
    setLoading(false)
  }, [targetPath, targetLegacy, fetchRows])

  useEffect(() => {
    let alive = true
    setCurrent(null); setLog([]); setPending(null)
    void loadCurrent().catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [loadCurrent])

  // 差し替え候補（ローカルの新しい画像）のプレビュー。選び直し・破棄でURLを解放する。
  useEffect(() => {
    if (!pending) { setPendingUrl(null); return }
    const u = URL.createObjectURL(pending)
    setPendingUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [pending])

  // ---- 実行 ----
  async function runReplace() {
    if (!target || !pending || busy) return
    setBusy(true); setLog([])
    try {
      const up = await supabase.storage.from(BUCKET).upload(
        target.path, pending, { upsert: true, contentType: pending.type || 'image/png' },
      )
      if (up.error) { add(`✗ 差し替えに失敗しました: ${up.error.message}`); return }
      add(`✓ 画像を上書きしました（${pending.name} → ${target.path}）`)

      // 登録状況は画面表示ではなくこの場で引き直したものを使う（表示が未取得・取得失敗の
      // まま「行が無い」と誤認して初期値を書き込むと、SQLで直した座標が巻き戻るため）。
      const rows = await fetchRows()
      if (rows === null) {
        add('⚠ 登録状況を確認できなかったため、denken_question_assets は変更していません（画像のみ差し替え済み）。')
      } else if (rows.length > 0) {
        // 登録済みの座標には触れない。SQLで直した値（§3）を初期値で巻き戻さないため。
        add('表示座標（denken_question_assets）は現在の登録値をそのまま維持しました。ずれた場合はSQLのUPDATEで直してください。')
      } else {
        const ins = await supabase
          .from('denken_question_assets')
          .upsert(target.rowsIfMissing, { onConflict: 'user_id,question_id,storage_path,sort' })
        if (ins.error) add(`✗ 登録に失敗しました: ${ins.error.message}`)
        else add(`✓ 未登録だったため ${target.rowsIfMissing.length} 件を登録しました（座標は定義の初期値）。`)
      }
      setPending(null)
      await loadCurrent()
    } catch (e) {
      add(`✗ 差し替え中にエラーが発生しました: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const selectClass = 'w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white'

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 leading-relaxed">
        取り込み済みの問題を1問選び、画像を1枚だけ上書きします。ファイル名は自動判定せず、選んだ問題の
        保存先（既存のファイル名）へそのまま保存するため、撮り直した画像の名前が元と違っていても構いません。
        <br />
        <span className="text-gray-400">表示座標はDBの現在値を維持します（座標の修正はSQLのUPDATE・docs/data-correction-workflow.md §3）。</span>
      </p>

      {/* 対象の種別 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {(['nendo', 'bunya'] as const).map(k => (
          <button key={k}
            onClick={() => { setKind(k); setLog([]); setPending(null) }}
            className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
              kind === k ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >{k === 'nendo' ? '年度別の1問' : '分野別の1枚'}</button>
        ))}
      </div>

      {/* 対象の選択 */}
      {kind === 'nendo' ? (
        <div className="space-y-2">
          <select value={paperSel} onChange={e => setPaperSel(e.target.value)} className={selectClass}>
            {subjectDefs.map(s => (s.papers && s.papers.length > 0) && (
              <optgroup key={s.id} label={s.name}>
                {s.papers.map(p => (
                  <option key={paperKey(p)} value={paperKey(p)}>{p.name}（{p.id}）{p.draft ? ' ※雛形' : ''}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <select value={questionSel} onChange={e => setQuestionSel(e.target.value)} className={selectClass}>
            {(paper?.questions ?? []).map(q => (
              <option key={q.id} value={q.id}>
                {q.section}問題 問{q.number}（{q.imageFile}）
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-2">
          <select value={chapterCode} onChange={e => setChapterCode(e.target.value)} className={selectClass}>
            {bunyaChapters.map(c => (
              <option key={c.code} value={c.code}>{c.subject} ／ {c.name}</option>
            ))}
          </select>
          <select value={fileSel} onChange={e => setFileSel(e.target.value)} className={selectClass}>
            {bunyaTargets.map(t => (
              <option key={t.filename} value={t.filename}>{t.label}（{t.filename}）</option>
            ))}
          </select>
        </div>
      )}

      {/* 差し替え先の現状。取り違え防止のため、上書き前に必ず現物を見せる。 */}
      {target && (
        <div className="border border-gray-200 rounded-xl p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700">{target.caption}</p>
              <p className="text-[10px] text-gray-400 break-all">{target.path}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadCurrent()}
              disabled={loading || busy}
              className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 disabled:text-gray-200"
              title="現状を再取得"
            ><RefreshCw size={14} /></button>
          </div>

          {loading ? (
            <p className="text-xs text-gray-400">現在の登録内容を確認中…</p>
          ) : (
            <div className="space-y-1">
              {!current?.url && (
                <p className="text-xs text-amber-600">
                  この問題の画像はまだ登録されていません。差し替えではなく新規登録になります。
                </p>
              )}
              {current?.fromLegacy && (
                <p className="text-[10px] text-amber-600">
                  現物は旧パスにあります。差し替えると新パスへ保存され、以後は新パスが使われます。
                </p>
              )}
              {/* 年度別の元画像は縦に長い。全体を縮小すると判別できないため、
                  上端（タイトル・問番号が写っている部分）を原寸比のまま見せる。 */}
              {(current?.url || pendingUrl) && (
                <div className="flex gap-2">
                  {current?.url && (
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 mb-0.5">現在</p>
                      <div className="rounded-lg border border-gray-100 bg-white overflow-hidden max-h-56">
                        <img src={current.url} alt="" className="w-full block" />
                      </div>
                    </div>
                  )}
                  {pendingUrl && (
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-blue-500 mb-0.5">差し替え後</p>
                      <div className="rounded-lg border border-blue-200 bg-white overflow-hidden max-h-56">
                        <img src={pendingUrl} alt="" className="w-full block" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && (current?.rows.length ?? 0) > 0 && (
            <div className="text-[10px] text-gray-400 space-y-0.5">
              {current!.rows.map(r => (
                <p key={`${r.question_id}_${r.sort}`}>
                  {r.question_id}
                  {r.region ? ` / ${r.region}` : ''}
                  {` / sort ${r.sort}`}
                  {kind === 'nendo'
                    ? ` / start ${r.question_start_pct} → answer ${r.answer_y_pct} → end ${r.explanation_end_pct}`
                    : ` / x ${r.answer_x_pct} / y ${r.answer_y_pct}`}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 画像の選択 → 確認 → 実行の2段階。誤った上書きは元画像が手元にしか無く復旧できないため。 */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && !busy) { setPending(f); setLog([]) } }}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          busy ? 'border-gray-200 bg-gray-50' : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50/40'
        }`}
      >
        <p className="text-sm text-gray-600">
          {pending ? `選択中: ${pending.name}` : '差し替える画像を1枚ドラッグ、またはタップして選択'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          // 同じファイルを選び直しても onChange が発火するよう、毎回 value を空へ戻す。
          onChange={e => { const f = e.target.files?.[0]; if (f) { setPending(f); setLog([]) } e.target.value = '' }}
        />
      </div>

      {pending && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void runReplace()}
            disabled={busy || !target}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:bg-gray-300"
          >{busy ? '差し替え中…' : 'この画像で上書きする'}</button>
          <button
            type="button"
            onClick={() => setPending(null)}
            disabled={busy}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 disabled:text-gray-300"
          >取消</button>
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
  )
}
