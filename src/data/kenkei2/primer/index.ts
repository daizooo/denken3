// 2級建設業経理士の「入門」タブ（docs/design/kenkei2-primer.md）。
// テーマ = 章、基礎ドリル = 問。ID は `K2_P_<テーマ>_<2桁>`（K2_ で始まるので AnyItemSolver が経理の画面へ振り分ける。
// 過去問の ID（K2_<回>_<大問>_<設問>）とは parseKk2Id で区別できる）。
// テーマを足すときは topics/ にファイルを足し、PRIMER_TOPICS の末尾に1行追加する（既存行の並び替え・削除をしない）。
import type { Chapter, MasterQuestion, SubjectDefinition } from '../../../domain/types'
import type { Kk2Row } from '../../../lib/kenkei2/cards'
import { PRIMER_SYMBOLS } from './symbols.ts'
import type { PrimerDrill, PrimerTopic } from './types.ts'
import { KIHON } from './topics/kihon.ts'
import { KENSETSU } from './topics/kensetsu.ts'
import { GENKA } from './topics/genka.ts'
import { KESSAN } from './topics/kessan.ts'
import { ZAIRYOU } from './topics/zairyou.ts'
import { HAIFU } from './topics/haifu.ts'
import { SHUEKI } from './topics/shueki.ts'
import { SEISAN } from './topics/seisan.ts'

/** テーマの並び ＝ 学習順。 */
export const PRIMER_TOPICS: PrimerTopic[] = [
  KIHON,
  KENSETSU,
  GENKA,
  KESSAN,
  ZAIRYOU,
  HAIFU,
  SHUEKI,
  SEISAN,
]

export const PRIMER_SUBJECT_NAME = '入門'

export const primerIdOf = (topicId: string, n: number) => `K2_P_${topicId}_${String(n).padStart(2, '0')}`

/** 'K2_P_kihon_01' → テーマID と 1始まりの番号。入門の ID でなければ undefined。 */
export function parsePrimerId(id: string): { topicId: string; n: number } | undefined {
  const m = /^K2_P_([a-z0-9]+)_(\d{2})$/.exec(id)
  return m ? { topicId: m[1], n: Number(m[2]) } : undefined
}

/** 入門タブ（科目）。純関数（テスト用に topics を受け取る）。 */
export function buildPrimerSubject(topics: PrimerTopic[]): SubjectDefinition {
  const chapters = topics.map((t): Chapter => {
    const questions: MasterQuestion[] = t.drills.map((d, i) => ({
      id: primerIdOf(t.id, i + 1),
      number: i + 1,
      title: d.title,
      difficulty: 1,
      studyMode: 'calc',
    }))
    return { code: `p_${t.id}`, name: t.name, subject: PRIMER_SUBJECT_NAME, totalCount: questions.length, questions }
  })
  return { id: 'nyumon', name: PRIMER_SUBJECT_NAME, chapters }
}

export const KENKEI2_PRIMER_SUBJECT = buildPrimerSubject(PRIMER_TOPICS)

/** ID からテーマとドリルを引く。 */
export function primerOf(id: string): { topic: PrimerTopic; drill: PrimerDrill; n: number } | undefined {
  const p = parsePrimerId(id)
  const topic = p && PRIMER_TOPICS.find(t => t.id === p.topicId)
  const drill = p && topic?.drills[p.n - 1]
  return p && topic && drill ? { topic, drill, n: p.n } : undefined
}

/** ドリルを過去問のカードと同じ形（Kk2Row）にする。解答画面・採点は過去問と共通。仕訳・金額とも満点で正解。 */
export function primerRowOf(id: string): Kk2Row | undefined {
  const hit = primerOf(id)
  if (!hit) return undefined
  const { drill, n } = hit
  const base = { id, exam_no: 0, sub: n, stem: drill.stem }
  if (drill.kind === 'journal') {
    return {
      ...base, part: 1, points: 4, form_kind: 'journal',
      frame: { symbols: PRIMER_SYMBOLS },
      key: { debit: drill.debit.map(([s, a]) => ({ s, a })), credit: drill.credit.map(([s, a]) => ({ s, a })) },
    }
  }
  return { ...base, part: 2, points: 3, form_kind: 'amount', frame: { unit: '円' }, key: { value: drill.value } }
}
