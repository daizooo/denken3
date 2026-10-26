// 「進級判定」の入口と画面（licensehub-expansion.md §8.2）。学習科目ごとに、次の科目へ進んでよいかを厳しめに判定する。
// App 側の組み込みをこの1要素だけにする。allText の資格（社労士）でだけ置く。
// 判定は表示のみで、次の科目の演習は止めない。不合格の科目は、弱点（直近 C・B の肢）をその場で順に解ける。
import { useMemo, useState } from 'react'
import { GraduationCap, X } from 'lucide-react'
import type { ExamDefinition, MasterQuestion, ReviewHistoryEntry, Status } from '../../domain/types'
import type { Attempt } from '../../lib/attempt'
import { titleJa } from '../../lib/license/idLabel'
import { SHAROUSHI_PROGRESSION } from '../../data/sharoushi/index.ts'
import { judgeProgression, type ProgressionVerdict } from '../../lib/license/progression'
import ItemSolver from './ItemSolver'

const VERDICT: Record<ProgressionVerdict, { label: string; cls: string }> = {
  pass: { label: '合格（次へ進んでよい）', cls: 'bg-green-100 text-green-800 border-green-400' },
  waiting: { label: '1回目合格（定着の確認待ち）', cls: 'bg-amber-100 text-amber-800 border-amber-400' },
  fail: { label: '不合格', cls: 'bg-red-100 text-red-800 border-red-400' },
  empty: { label: '肢なし（未取り込み）', cls: 'bg-gray-100 text-gray-600 border-gray-300' },
}

export default function ProgressionButton({
  userId, exam, historyOf, onRecord, onDeleteEntry,
}: {
  userId: string
  exam: ExamDefinition
  historyOf: (id: string) => ReviewHistoryEntry[]
  /** 記録（App の updateStatus）。記録日を返す（取り消しに使う）。 */
  onRecord: (id: string, status: Status, attempt: Attempt) => string
  onDeleteEntry: (id: string, index: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [drill, setDrill] = useState<{ ids: string[]; i: number } | null>(null)
  const [last, setLast] = useState<{ id: string; date: string; status: Status } | null>(null)

  const titleOf = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of exam.subjects) for (const c of s.chapters) for (const q of c.questions) m[q.id] = `${s.name}｜${titleJa(q.title)}`
    return m
  }, [exam])

  // 開いている間だけ計算する（historyOf は記録のたびに変わる）
  const rows = useMemo(() => (open ? exam.subjects.map(s => {
    const items: MasterQuestion[] = s.chapters.flatMap(c => c.questions)
    return { subject: s, result: judgeProgression(items, historyOf, SHAROUSHI_PROGRESSION) }
  }) : []), [open, exam, historyOf])

  const id = drill ? drill.ids[drill.i] : null
  const next = () => setDrill(d => (d && d.i + 1 < d.ids.length ? { ...d, i: d.i + 1 } : null))

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border bg-white text-sm text-gray-700"
      >
        <GraduationCap size={16} /> 進級判定
      </button>

      {open && !drill && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <h2 className="flex-1 text-sm font-bold text-gray-700">進級判定（学習科目ごと）</h2>
              <button onClick={() => setOpen(false)} aria-label="閉じる" className="p-1 text-gray-500"><X size={20} /></button>
            </div>
            <p className="text-xs text-gray-500">
              合格の条件: ①その科目の肢をすべて1回以上解いた ②直近が「正解・確信」の肢が {Math.round(SHAROUSHI_PROGRESSION.minSureRate * 100)}%以上（迷いの正解は数えない）
              ③重要度Aの肢の直近の誤答が0 ④①〜③を {SHAROUSHI_PROGRESSION.gapDays}日以上空けて2回満たす。判定は表示のみで、次の科目の演習は止めません。
            </p>
            {rows.map(({ subject, result: r }) => (
              <div key={subject.id} className="border rounded-xl p-2 space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-gray-700 w-12">{subject.name}</span>
                  <span className={`text-xs border rounded px-2 py-0.5 ${VERDICT[r.verdict].cls}`}>{VERDICT[r.verdict].label}</span>
                  {r.current.total > 0 && (
                    <span className="text-xs text-gray-500">
                      解いた {r.current.attempted}/{r.current.total}・確信正答率 {Math.round(r.current.sureRate * 100)}%・重要度Aの誤答 {r.current.importantMisses.length}
                    </span>
                  )}
                </div>
                {r.verdict !== 'pass' && r.verdict !== 'empty' && r.reasons.length > 0 && (
                  <p className="text-xs text-gray-600">{r.reasons.join(' ／ ')}</p>
                )}
                {r.weakIds.length > 0 && (
                  <button
                    onClick={() => setDrill({ ids: r.weakIds, i: 0 })}
                    className="text-xs px-2 py-1 rounded border border-indigo-600 text-indigo-700"
                  >
                    弱点を解く（{r.weakIds.length} 肢。誤答→迷いの順）
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {drill && id && (
        <>
          <ItemSolver
            key={id}
            itemId={id}
            title={`弱点 ${drill.i + 1}/${drill.ids.length}　${titleOf[id] ?? id}（閉じると次へ）`}
            userId={userId}
            onClose={next}
            onRecord={(s, attempt) => setLast({ id, date: onRecord(id, s, attempt), status: s })}
            onUndoRecord={() => {
              if (!last || last.id !== id) return
              const i = historyOf(id).findLastIndex(e => e.date === last.date && e.status === last.status)
              if (i >= 0) onDeleteEntry(id, i)
              setLast(null)
            }}
          />
          <button
            onClick={() => setDrill(null)}
            className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] px-3 py-1 rounded-full bg-gray-800 text-white text-xs"
          >
            弱点の演習を終える
          </button>
        </>
      )}
    </>
  )
}
