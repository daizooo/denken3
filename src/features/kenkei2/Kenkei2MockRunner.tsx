// 本番形式模試の解答画面（docs/design/kenkei2.md §7 K6）。12枚を120分で通しで解く。
// - 左の一覧で大問を行き来する（解答済みに ✓）。採点するのは「終了して採点」を押したときだけ（解答中は正誤を出さない）
// - 残り時間は画面を見ている間だけ減る（タブが隠れている間は止める）。0 で自動終了→採点
// - 解答は変更から2秒後と30秒ごとに autosave（保存は呼び出し側）。中断して閉じても残り時間・解答から再開できる
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Kk2Row } from '../../lib/kenkei2/cards'
import { answeredCount, cardLabel, emptyCardDraft, formatRemaining, isAnswered, KK2_MOCK, type CardDraft, type MockAnswers } from '../../lib/kenkei2/mock'
import CardAnswerForm from './CardAnswerForm'

export default function Kenkei2MockRunner({ kai, rows, initialAnswers, initialRemaining, onAutosave, onSuspend, onFinish }: {
  kai: number
  rows: Kk2Row[]
  initialAnswers: MockAnswers
  initialRemaining: number
  onAutosave: (answers: MockAnswers, remaining: number) => void
  onSuspend: (answers: MockAnswers, remaining: number) => void
  onFinish: (answers: MockAnswers, remaining: number) => void
}) {
  const [answers, setAnswers] = useState<MockAnswers>(() => ({ ...initialAnswers }))
  const [idx, setIdx] = useState(0)
  const [clock, setClock] = useState(initialRemaining)
  const [confirm, setConfirm] = useState(false)
  const answersRef = useRef(answers)
  const clockRef = useRef(clock)
  const finished = useRef(false)
  answersRef.current = answers
  clockRef.current = clock

  const row = rows[idx]
  const draft: CardDraft = answers[row.id] ?? emptyCardDraft()
  const setDraft = (f: (d: CardDraft) => CardDraft) => setAnswers(a => ({ ...a, [row.id]: f(a[row.id] ?? emptyCardDraft()) }))

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    onFinish(answersRef.current, clockRef.current)
  }, [onFinish])

  // 残り時間（画面が見えている間だけ減らす）
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible' || finished.current) return
      setClock(c => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => { if (clock <= 0) finish() }, [clock, finish])

  // autosave: 解答の変更から2秒後と、30秒ごと
  useEffect(() => {
    const t = setTimeout(() => { if (!finished.current) onAutosave(answers, clockRef.current) }, 2000)
    return () => clearTimeout(t)
  }, [answers, onAutosave])
  useEffect(() => {
    const t = setInterval(() => { if (!finished.current) onAutosave(answersRef.current, clockRef.current) }, 30000)
    return () => clearInterval(t)
  }, [onAutosave])

  const unanswered = rows.length - answeredCount(rows, answers)
  const low = clock <= 10 * 60

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <span className="text-sm font-bold text-gray-700">第{kai}回 本番形式模試</span>
        <span className={`rounded px-2 py-0.5 font-mono text-sm tabular-nums ${low ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`} aria-label="残り時間">
          残り {formatRemaining(clock)}
        </span>
        <span className="text-xs text-gray-500">解答済み {rows.length - unanswered}/{rows.length}（{KK2_MOCK.limitMin}分・{KK2_MOCK.maxScore}点満点・{KK2_MOCK.passScore}点以上で合格）</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => { finished.current = true; onSuspend(answers, clock) }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700">中断して閉じる</button>
          <button onClick={() => setConfirm(true)}
            className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white">終了して採点</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <nav aria-label="問題の一覧" className="flex flex-row flex-wrap gap-1.5 lg:flex-col">
          {rows.map((r, i) => (
            <button key={r.id} onClick={() => setIdx(i)}
              className={`rounded-lg border px-2 py-1.5 text-left text-xs ${i === idx ? 'border-blue-600 bg-blue-50 font-bold text-blue-800' : 'border-gray-200 bg-white text-gray-700'}`}>
              {cardLabel(r)}　<span className="text-gray-400">{r.points}点</span>
              {isAnswered(answers[r.id]) && <span className="ml-1 text-green-600">✓</span>}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-3">
          <div className="text-xs text-gray-500">
            <span className="font-bold text-gray-700">{cardLabel(row)}</span>　{row.points}点（配点は資格スクール大栄の予想）
          </div>
          <CardAnswerForm key={row.id} row={row} draft={draft} setDraft={setDraft} result={null} />
          <div className="flex justify-between">
            <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-40">← 前の問題</button>
            <button disabled={idx === rows.length - 1} onClick={() => setIdx(idx + 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-40">次の問題 →</button>
          </div>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-4">
            <p className="text-sm font-bold text-gray-800">採点しますか？</p>
            <p className="text-sm text-gray-600">
              {unanswered > 0 ? `未解答が ${unanswered} 問あります（0点になります）。` : 'すべての問に解答があります。'}
              採点すると、誤答・未解答の問は復習に入ります。
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirm(false)} className="rounded-lg border border-gray-300 py-2 text-sm text-gray-700">続ける</button>
              <button onClick={() => { setConfirm(false); finish() }} className="rounded-lg bg-blue-700 py-2 text-sm font-bold text-white">採点する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
