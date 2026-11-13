// 入門ノート一覧に出す章（ノート＋その章の問題）を資格ごとに組み立てる。
import { PRIMER_TOPICS, primerIdOf } from '../../data/kenkei2/primer/index'
import { D1_PRIMER_TOPICS, d1PrimerIdOf } from '../../data/doboku1/primer/index'
import type { PrimerNotesTopic } from './PrimerNotesView'

/** 資格ごとの章（ノート＋その章の問題）。 */
export function primerNotesTopics(examId: string): PrimerNotesTopic[] {
  if (examId === 'kenkei2') {
    return PRIMER_TOPICS.map(t => ({ ...t, items: t.drills.map((d, i) => ({ id: primerIdOf(t.id, i + 1), title: d.title })) }))
  }
  if (examId === 'doboku1') {
    return D1_PRIMER_TOPICS.map(t => ({ ...t, items: t.quizzes.map((q, i) => ({ id: d1PrimerIdOf(t.id, i + 1), title: q.title })) }))
  }
  return []
}
