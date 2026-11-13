// 1級土木の「入門」タブ（docs/design/doboku1-primer.md）。
// 章 = 学習分野（着手順）、問 = ○×一問一答。ID は `D1_P_<分野>_<2桁>`（D1_ で始まるので AnyItemSolver が土木の画面へ振り分ける。
// 過去問の ID（D1_R08_A_01）の解析 dbkCategoryOfId は R\d{2} を要求するので入門の ID とは衝突しない）。
// 分野を足すときは topics/ にファイルを足し、import と D1_PRIMER_TOPICS の末尾に1行ずつ追加する（既存行の並び替え・削除をしない）。
import type { Chapter, MasterQuestion, SubjectDefinition } from '../../../domain/types'
import type { Attempt, Confidence } from '../../../lib/attempt'
import type { D1PrimerQuiz, D1PrimerTopic } from './types.ts'
import { DOKOU } from './topics/dokou.ts'
import { CONCRETE } from './topics/concrete.ts'
import { HINSHITSU } from './topics/hinshitsu.ts'
import { ANZEN } from './topics/anzen.ts'
import { KOUTEI } from './topics/koutei.ts'
import { KEIKAKU } from './topics/keikaku.ts'
import { KISOKOU } from './topics/kisokou.ts'
import { KISO } from './topics/kiso.ts'

/** 分野の並び ＝ 着手順（設計 §3）。 */
export const D1_PRIMER_TOPICS: D1PrimerTopic[] = [
  DOKOU,
  CONCRETE,
  HINSHITSU,
  ANZEN,
  KOUTEI,
  KEIKAKU,
  KISOKOU,
  KISO,
]

export const D1_PRIMER_SUBJECT_NAME = '入門'

export const d1PrimerIdOf = (topicId: string, n: number) => `D1_P_${topicId}_${String(n).padStart(2, '0')}`

/** 'D1_P_dokou_01' → 分野ID と 1始まりの番号。入門の ID でなければ undefined。 */
export function parseD1PrimerId(id: string): { topicId: string; n: number } | undefined {
  const m = /^D1_P_([a-z0-9]+)_(\d{2})$/.exec(id)
  return m ? { topicId: m[1], n: Number(m[2]) } : undefined
}

/** 入門タブ（科目）。純関数（テスト用に topics を受け取る）。 */
export function buildD1PrimerSubject(topics: D1PrimerTopic[]): SubjectDefinition {
  const chapters = topics.map((t): Chapter => {
    const questions: MasterQuestion[] = t.quizzes.map((q, i) => ({
      id: d1PrimerIdOf(t.id, i + 1),
      number: i + 1,
      title: q.title,
      difficulty: 1,
      studyMode: 'memory',
    }))
    return { code: `p_${t.id}`, name: t.name, subject: D1_PRIMER_SUBJECT_NAME, totalCount: questions.length, questions }
  })
  return { id: 'nyumon', name: D1_PRIMER_SUBJECT_NAME, chapters }
}

export const DOBOKU1_PRIMER_SUBJECT = buildD1PrimerSubject(D1_PRIMER_TOPICS)

/** ID から分野と問を引く。 */
export function d1PrimerOf(id: string): { topic: D1PrimerTopic; quiz: D1PrimerQuiz; n: number } | undefined {
  const p = parseD1PrimerId(id)
  const topic = p && D1_PRIMER_TOPICS.find(t => t.id === p.topicId)
  const quiz = p && topic?.quizzes[p.n - 1]
  return p && topic && quiz ? { topic, quiz, n: p.n } : undefined
}

/** ○×の解答（社労士の肢モードと同じく selected [1]=○、[2]=×。null は「分からない」）。 */
export function maruBatsuAttempt(pick: boolean | null, confidence: Confidence | undefined, answer: boolean): Attempt {
  if (pick === null) return { gaveUp: true, correct: false }
  return { selected: [pick ? 1 : 2], ...(confidence ? { confidence } : {}), correct: pick === answer }
}
