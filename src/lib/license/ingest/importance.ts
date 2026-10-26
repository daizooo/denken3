// 重要度（A/B/C）の算出（licensehub-expansion.md §14: 書籍に重要度が無いときは出題回数から付ける）。
// 論点（topic_id）ごとに、本試験で出た肢の数を数え、多い順に並べた累積の割合（ABC分析）で分ける。
//   A: 直前までの累積が aShare（既定50%）に届いていない論点 = 上位から約半数の肢を占める論点
//   B: 同じく bShare（既定80%）に届いていない論点
//   C: それ以外
// 科目（study_subject）ごとに別々に呼ぶ。冊子や年度が増えたら同じ入力で再計算すればよい（純関数）。
// 論点の無い肢（topic_id が null）は数えず、重要度も付けない。除外（excluded）の肢は数えない。
import type { Importance } from '../../../domain/license.ts'

export interface ImportanceSourceItem {
  topic_id: string | null
  law_status?: string | null
}

export interface TopicImportance {
  topic: string
  count: number
  cumulativeShare: number // この論点を含めた累積の割合
  importance: Importance
}

const byNatural = (a: string, b: string) => a.localeCompare(b, 'ja', { numeric: true })

export function computeTopicImportance(
  items: ImportanceSourceItem[],
  opts: { aShare?: number; bShare?: number } = {},
): TopicImportance[] {
  const aShare = opts.aShare ?? 0.5
  const bShare = opts.bShare ?? 0.8
  const counts = new Map<string, number>()
  for (const it of items) {
    const topic = it.topic_id?.trim()
    if (!topic || it.law_status === 'excluded') continue
    counts.set(topic, (counts.get(topic) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, n) => a + n, 0)
  // 件数の多い順。同数は論点名の自然順（入力の順序に依らず同じ結果にする）。
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || byNatural(a[0], b[0]))
  let before = 0
  return sorted.map(([topic, count]) => {
    const importance: Importance = before / total < aShare ? 'A' : before / total < bShare ? 'B' : 'C'
    before += count
    return { topic, count, cumulativeShare: before / total, importance }
  })
}
