import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Flag, Grid3x3, PauseCircle, ZoomIn, ZoomOut } from 'lucide-react'
import type { MockAnswer, MockMode, MockSession, PaperDefinition, PaperQuestion } from '../../domain/types'
import { isAnswered } from '../../lib/mock'
import PaperImage from './PaperImage'

// CBT解答画面（§7.4(2)）。本番CBTに準拠した操作で解く。
// - ヘッダー: 残り時間カウントダウン（フリーは経過時間）・解答済み/全問数
// - 問題画像を原寸表示（zoomで拡大）、(1)〜(5) 選択、B問題は(a)(b)個別
// - 問題一覧グリッドから任意ジャンプ・後で見直しフラグ
// - 選択問題（selectable）は解答した1問だけが採点対象（排他）
// - 中断: remaining_seconds を保存して退出。解答は都度 autosave されるため失われない
// - 時間切れ（cbt）は自動終了→自動採点
export default function CBTRunner({
  userId, paper, mode, initial, onAutosave, onSuspend, onFinish,
}: {
  userId: string
  paper: PaperDefinition
  mode: MockMode
  initial: MockSession
  onAutosave: (answers: Record<string, MockAnswer>, remaining: number | null) => void
  onSuspend: (answers: Record<string, MockAnswer>, remaining: number | null) => void
  onFinish: (answers: Record<string, MockAnswer>, remaining: number | null) => void
}) {
  const total = paper.questions.length
  const limitSec = paper.timeLimitMin * 60

  const [answers, setAnswers] = useState<Record<string, MockAnswer>>(() => ({ ...initial.answers }))
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [showFinish, setShowFinish] = useState(false)
  // cbt: 残り秒 / free: 経過秒
  const [clock, setClock] = useState<number>(
    mode === 'cbt' ? (initial.remaining_seconds ?? limitSec) : 0,
  )

  // 問題別の表示秒数（§7.6）は毎秒更新するが再描画/autosaveを避けるため ref で持つ。
  const secondsRef = useRef<Record<string, number>>(
    Object.fromEntries(paper.questions.map(q => [q.id, initial.answers[q.id]?.seconds ?? 0])),
  )
  const hiddenRef = useRef(false)
  const finishedRef = useRef(false)
  const q = paper.questions[idx]

  // 現在の解答状態＋計測秒を1つの answers に畳んで返す（保存用）。
  const foldedAnswers = useCallback((base: Record<string, MockAnswer>) => {
    const out: Record<string, MockAnswer> = {}
    for (const pq of paper.questions) {
      const a = base[pq.id]
      const sec = secondsRef.current[pq.id]
      if (a || sec) out[pq.id] = { selected: a?.selected ?? [], flagged: a?.flagged, seconds: sec || undefined }
    }
    return out
  }, [paper.questions])

  const doFinish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinish(foldedAnswers(answers), mode === 'cbt' ? clock : null)
  }, [answers, clock, mode, onFinish, foldedAnswers])

  // インターバルを毎秒/毎解答で貼り直さないよう、変化する値は ref 経由で参照する。
  const qIdRef = useRef(q.id); qIdRef.current = q.id
  const doFinishRef = useRef(doFinish); doFinishRef.current = doFinish
  const autosaveNowRef = useRef<() => void>(() => {})
  autosaveNowRef.current = () => {
    if (!finishedRef.current) onAutosave(foldedAnswers(answers), mode === 'cbt' ? clock : null)
  }

  // 1秒ごと: 表示中の問題の計測を進め、cbtは残り時間を減らす（0で自動終了）。
  // 依存は mode のみ（q.id・doFinish は ref 経由）で、インターバルは安定する。
  useEffect(() => {
    const iv = setInterval(() => {
      if (hiddenRef.current) return
      const id = qIdRef.current
      secondsRef.current[id] = (secondsRef.current[id] ?? 0) + 1
      if (mode === 'cbt') {
        setClock(prev => {
          const next = prev - 1
          if (next <= 0) { queueMicrotask(() => doFinishRef.current()); return 0 }
          return next
        })
      } else {
        setClock(prev => prev + 1)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [mode])

  // 離席（タブ非表示）中は計測・カウントダウンを止める（§7.6と同方針）。
  useEffect(() => {
    const onVis = () => { hiddenRef.current = document.hidden }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // 30秒ごとに残り時間を含めて autosave（解答自体は変更時に即 autosave する）。
  useEffect(() => {
    const iv = setInterval(() => autosaveNowRef.current(), 30000)
    return () => clearInterval(iv)
  }, [])

  const selectableGroup = useMemo(
    () => paper.questions.filter(pq => pq.selectable).map(pq => pq.id),
    [paper.questions],
  )

  // 解答をセット（変更時に即 autosave）。selectable は排他。
  const setPart = useCallback((question: PaperQuestion, partIdx: number, value: number) => {
    setAnswers(prev => {
      const next = { ...prev }
      const cur = next[question.id]?.selected ?? question.parts.map(() => 0)
      const selected = [...cur]
      selected[partIdx] = value
      next[question.id] = { ...next[question.id], selected }
      // 選択問題を解答したら、同群の他の選択問題の解答をクリアする（本番の択一を再現）。
      if (question.selectable) {
        for (const gid of selectableGroup) {
          if (gid !== question.id && next[gid]) next[gid] = { ...next[gid], selected: [] }
        }
      }
      queueMicrotask(() => onAutosave(foldedAnswers(next), mode === 'cbt' ? clock : null))
      return next
    })
  }, [selectableGroup, onAutosave, foldedAnswers, mode, clock])

  const toggleFlag = useCallback((qid: string) => {
    setAnswers(prev => {
      const next = { ...prev, [qid]: { selected: prev[qid]?.selected ?? [], flagged: !prev[qid]?.flagged, seconds: prev[qid]?.seconds } }
      queueMicrotask(() => onAutosave(foldedAnswers(next), mode === 'cbt' ? clock : null))
      return next
    })
  }, [onAutosave, foldedAnswers, mode, clock])

  const answeredCount = paper.questions.filter(pq => isAnswered(answers[pq.id])).length
  const flaggedCount = paper.questions.filter(pq => answers[pq.id]?.flagged).length
  const cur = answers[q.id]

  const mm = Math.floor(clock / 60)
  const ss = String(clock % 60).padStart(2, '0')
  const timeLow = mode === 'cbt' && clock <= 300 // 残り5分

  return (
    <div className="fixed inset-0 z-40 bg-gray-100 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-2 shrink-0">
        <span className={`font-mono font-bold text-sm px-2 py-1 rounded-lg ${
          timeLow ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {mode === 'cbt' ? '残 ' : '経過 '}{mm}:{ss}
        </span>
        <span className="text-xs text-gray-500">解答 {answeredCount}/{total}</span>
        <div className="flex-1" />
        <button onClick={() => setZoom(z => !z)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title={zoom ? '縮小' : '拡大'}>
          {zoom ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
        </button>
        <button onClick={() => setShowGrid(true)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="問題一覧">
          <Grid3x3 size={18} />
        </button>
        <button
          onClick={() => onSuspend(foldedAnswers(answers), mode === 'cbt' ? clock : null)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-600 hover:bg-gray-100"
          title="中断（残り時間を保存して退出）"
        >
          <PauseCircle size={16} /> 中断
        </button>
      </div>

      {/* 本体 */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800">
            問{q.number}
            <span className="ml-1 text-xs font-normal text-gray-400">{q.section}問題{q.selectable ? '・選択' : ''}</span>
          </span>
          <button
            onClick={() => toggleFlag(q.id)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
              cur?.flagged ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-400 border-gray-200'
            }`}
          >
            <Flag size={12} /> {cur?.flagged ? '見直す' : 'フラグ'}
          </button>
        </div>

        {q.selectable && (
          <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
            選択問題です。解答するとこの問題が採点対象になり、同じ選択群の他問の解答は取り消されます。
          </p>
        )}

        <PaperImage userId={userId} paperId={paper.id} filename={q.imageFile} zoom={zoom} />

        {/* 解答操作 */}
        <div className="space-y-2">
          {q.parts.map((part, pi) => (
            <div key={pi} className="flex items-center gap-2">
              {part.label && <span className="text-xs font-medium text-gray-500 w-8">{part.label}</span>}
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5].map(v => {
                  const chosen = (cur?.selected[pi] ?? 0) === v
                  return (
                    <button
                      key={v}
                      onClick={() => setPart(q, pi, v)}
                      className={`w-11 h-11 rounded-xl text-sm font-bold border-2 transition-colors ${
                        chosen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}
                    >{v}</button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* フッター（前後移動・終了） */}
      <div className="bg-white border-t border-gray-200 px-3 py-2 flex items-center gap-2 shrink-0">
        <button
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-gray-600 disabled:text-gray-300 hover:bg-gray-100"
        ><ChevronLeft size={16} /> 前へ</button>
        <div className="flex-1 text-center text-xs text-gray-400">{idx + 1} / {total}</div>
        {idx < total - 1 ? (
          <button
            onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >次へ <ChevronRight size={16} /></button>
        ) : (
          <button
            onClick={() => setShowFinish(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
          >試験終了</button>
        )}
      </div>

      {/* 問題一覧グリッド */}
      {showGrid && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowGrid(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-4 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-gray-800 mb-1">問題一覧</p>
            <p className="text-xs text-gray-400 mb-3">
              <span className="inline-block w-3 h-3 rounded bg-blue-600 align-middle" /> 解答済み
              <span className="inline-block w-3 h-3 rounded bg-white border border-gray-300 align-middle" /> 未解答
              <Flag size={11} className="inline text-amber-500 align-middle" /> フラグ
            </p>
            <div className="grid grid-cols-6 gap-2">
              {paper.questions.map((pq, i) => {
                const done = isAnswered(answers[pq.id])
                const flag = answers[pq.id]?.flagged
                return (
                  <button
                    key={pq.id}
                    onClick={() => { setIdx(i); setShowGrid(false) }}
                    className={`relative h-11 rounded-lg text-xs font-bold border-2 ${
                      i === idx ? 'ring-2 ring-blue-400 ' : ''
                    }${done ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
                  >
                    {pq.number}
                    {flag && <Flag size={10} className="absolute -top-1 -right-1 text-amber-500 fill-amber-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 終了確認 */}
      {showFinish && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowFinish(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-gray-800">試験を終了して採点しますか？</p>
            <p className="text-xs text-gray-500">
              未解答 {total - answeredCount} 問／フラグ {flaggedCount} 問。
              採点後は解説を確認できます。
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowFinish(false)} className="flex-1 py-2 rounded-lg text-sm text-gray-600 bg-gray-100 hover:bg-gray-200">戻る</button>
              <button onClick={doFinish} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">採点する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
