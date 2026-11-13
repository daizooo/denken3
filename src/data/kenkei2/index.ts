// 2級建設業経理士の資格定義（docs/design/kenkei2.md）。
// 社労士・1級土木と同じ資格レジストリ（EXAMS）に載せ、同じメイン画面（今日パネル・復習/一覧/分析・絞り込み）で動かす。
// 違うのは解答画面だけ（記述式。AnyItemSolver が K2_ の ID を Kenkei2ItemSolver に振り分ける）。
//   科目（タブ）= 大問の種類（仕訳・金額・原価計算・精算表）、章 = 回、問 = 回ごとの索引（masters/）。
import type { Chapter, ExamDefinition, MasterQuestion, SubjectDefinition } from '../../domain/types'
import { KENKEI2_MASTERS } from './masters/index.ts'
import type { Kk2Master } from './masters/types.ts'
import { KENKEI2_PRIMER_SUBJECT } from './primer/index.ts'

export const KENKEI2_EXAM_ID = 'kenkei2'   // denken_reviews.exam_id（lib/kenkei2/record.ts と同じ）

/** 科目（タブ）と、含む大問。並び＝学習順の既定。 */
const KENKEI2_SUBJECT_GROUPS: { id: string; name: string; parts: number[] }[] = [
  { id: 'shiwake', name: '仕訳', parts: [1] },
  { id: 'kingaku', name: '金額', parts: [2] },
  { id: 'genka', name: '原価計算', parts: [3, 4] },
  { id: 'seisan', name: '精算表', parts: [5] },
]

/** 'K2_39_1_1' → 回・大問。解釈できなければ undefined。 */
export function parseKk2Id(id: string): { kai: number; part: number; sub: number } | undefined {
  const m = /^K2_(\d+)_([1-5])_(\d)$/.exec(id)
  return m ? { kai: Number(m[1]), part: Number(m[2]), sub: Number(m[3]) } : undefined
}

/** 索引から章（回）を組み立てる。純関数（テスト用に masters を受け取る）。新しい回が先。 */
export function buildKenkei2Subjects(masters: Kk2Master[]): SubjectDefinition[] {
  return KENKEI2_SUBJECT_GROUPS.map(g => {
    const byKai = new Map<number, Kk2Master[]>()
    for (const m of masters) {
      const p = parseKk2Id(m.id)
      if (!p || !g.parts.includes(p.part)) continue
      byKai.set(p.kai, [...(byKai.get(p.kai) ?? []), m])
    }
    const chapters = [...byKai.keys()].sort((a, b) => b - a).map((kai): Chapter => {
      const questions: MasterQuestion[] = (byKai.get(kai) ?? []).map((m, i) => ({
        id: m.id, number: i + 1, title: m.title, difficulty: 2, studyMode: m.studyMode,
      }))
      return { code: `k${kai}`, name: `第${kai}回`, subject: g.name, totalCount: questions.length, questions }
    })
    return { id: g.id, name: g.name, chapters }
  })
}

export const KENKEI2_EXAM: ExamDefinition = {
  id: KENKEI2_EXAM_ID,
  name: '2級建設経理',
  // 合格基準は70点以上と理解している（公式で未確認。docs/design/kenkei2.md §2）。
  passingScore: 70,
  features: {},
  // 先頭は「入門」（前提知識のノート＋基礎ドリル。docs/design/kenkei2-primer.md）。初学者が最初に開くタブにする。
  subjects: [KENKEI2_PRIMER_SUBJECT, ...buildKenkei2Subjects(KENKEI2_MASTERS)],
}
