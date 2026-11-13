// 1級土木施工管理技士 第一次検定の資格定義（docs/design/doboku1-ichiji.md）。
// 社労士と同じ資格レジストリ（EXAMS）に載せ、同じメイン画面（今日パネル・復習/一覧/分析・絞り込み）で動かす。
// 違うのは解答画面だけ（四肢択一。AnyItemSolver が D1_ の ID を Doboku1ItemSolver に振り分ける）。
//   科目（タブ）= 試験の区分、章 = 学習分野（DOBOKU1_CATEGORIES）、問 = 年度の索引（masters/）。
import type { Chapter, ExamDefinition, MasterQuestion, SubjectDefinition } from '../../domain/types'
import type { Paper } from '../../lib/doboku1/types.ts'
import { DOBOKU1_CATEGORIES, categoryOf, yearIndexOf } from './categories.ts'
import { DOBOKU1_MASTERS } from './masters/index.ts'
import type { DbkMaster } from './masters/types.ts'
import { DOBOKU1_PRIMER_SUBJECT } from './primer/index.ts'

/** 科目（タブ）と、含む学習分野。並び＝学習順の既定。 */
const DOBOKU1_SUBJECT_GROUPS: { id: string; name: string; categories: string[] }[] = [
  { id: 'ippan', name: '土木一般', categories: ['kiso', 'dokou', 'concrete', 'kisokou'] },
  { id: 'senmon', name: '専門土木', categories: ['kouzou', 'kasen', 'douro', 'damtunnel', 'kaigan', 'tetsudou', 'suidou'] },
  { id: 'houki', name: '法規', categories: ['houki'] },
  { id: 'sekou', name: '施工管理', categories: ['kyoutsu', 'keikaku', 'koutei', 'anzen', 'hinshitsu', 'kankyou'] },
]

/** 'D1_R08_A_01' → 学習分野ID。索引に無ければ undefined。 */
export function dbkCategoryOfId(id: string): string | undefined {
  const m = /^D1_(R\d{2})_([AB])_(\d{2})$/.exec(id)
  if (!m) return undefined
  const idx = yearIndexOf(m[1])
  return idx ? categoryOf(idx, m[2] as Paper, Number(m[3])) : undefined
}

/** 索引から章（学習分野）を組み立てる。純関数（テスト用に masters を受け取る）。 */
export function buildDoboku1Subjects(masters: DbkMaster[]): SubjectDefinition[] {
  const byCat = new Map<string, DbkMaster[]>()
  for (const m of masters) {
    const c = dbkCategoryOfId(m.id)
    if (!c) continue
    byCat.set(c, [...(byCat.get(c) ?? []), m])
  }
  return DOBOKU1_SUBJECT_GROUPS.map(g => ({
    id: g.id,
    name: g.name,
    chapters: g.categories.map((cat): Chapter => {
      const name = DOBOKU1_CATEGORIES.find(c => c.id === cat)?.name ?? cat
      const questions: MasterQuestion[] = (byCat.get(cat) ?? []).map((m, i) => ({
        id: m.id, number: i + 1, title: m.title, difficulty: 2, studyMode: m.studyMode,
      }))
      return { code: cat, name, subject: g.name, totalCount: questions.length, questions }
    }),
  }))
}

export const DOBOKU1_EXAM: ExamDefinition = {
  id: 'doboku1',   // denken_reviews.exam_id（lib/doboku1/record.ts の DOBOKU1_EXAM_ID と同じ）
  name: '1級土木',
  // 合格基準は原則60%（応用能力の基準点は年度で確認。doboku1-ichiji.md §4）。
  passingScore: 60,
  features: {},
  // 先頭は「入門」（前提知識のノート＋○×一問一答。docs/design/doboku1-primer.md）。初学者が最初に開くタブにする。
  subjects: [DOBOKU1_PRIMER_SUBJECT, ...buildDoboku1Subjects(DOBOKU1_MASTERS)],
}
