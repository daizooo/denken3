// 2級建設業経理士の本番形式模試（docs/design/kenkei2.md §7 K6）。すべて純関数。
// 1回分（12枚）を90分で通しで解き、100点満点・70点以上で合格（配点は大栄の予想・合格基準は未確認。§2）。
// セッションは denken_mock_sessions（exam_id='kenkei2'、subject_id='kk2'、paper_id=回、mode='cbt'）。
import { gradeCard, passRateOf, type CardResult, type Kk2Row } from './cards.ts'
import { isBlank } from './normalize.ts'
import type { JournalInput } from './types.ts'

export const KK2_MOCK = {
  examId: 'kenkei2',
  subjectId: 'kk2',
  limitMin: 90,
  passScore: 70,
  maxScore: 100,
  cardsPerPaper: 12,
} as const

/** 1カードの下書き（解答の入力。解答画面と模試で同じ形）。 */
export interface CardDraft {
  answers: Record<string, string>
  journal: JournalInput
  memo: string
}

/** 模試の解答。カードID → 下書き。denken_mock_sessions.answers（JSONB）にそのまま入る。 */
export type MockAnswers = Record<string, CardDraft>

export const emptyCardDraft = (): CardDraft => ({
  answers: {},
  journal: { debit: [{ symbol: '', amount: '' }, { symbol: '', amount: '' }], credit: [{ symbol: '', amount: '' }, { symbol: '', amount: '' }] },
  memo: '',
})

/** 何か入力されているか（模試の「未解答」表示用）。メモだけの入力は解答とみなさない。 */
export function isAnswered(d: CardDraft | undefined): boolean {
  if (!d) return false
  if (Object.values(d.answers).some(v => !isBlank(v))) return true
  return [...d.journal.debit, ...d.journal.credit].some(l => !isBlank(l.symbol) || !isBlank(l.amount))
}

export interface MockCardScore {
  id: string
  part: number
  sub: number
  earned: number
  max: number
  rate: number
  /** 理解度を決める「正解」（仕訳・金額は満点、第3〜5問は得点率80%以上）。 */
  correct: boolean
  result: CardResult
}

export interface MockScore {
  total: number
  max: number
  passed: boolean
  /** 大問（'1'〜'5'）ごとの得点。 */
  bySection: Record<string, number>
  cards: MockCardScore[]
}

/** 模試の採点。rows は1回分のカード（問の順は大問・設問）。答えが無いカードは 0 点。 */
export function scoreMock(rows: Kk2Row[], answers: MockAnswers): MockScore {
  const sorted = [...rows].sort((a, b) => a.part - b.part || a.sub - b.sub)
  const cards = sorted.map((row): MockCardScore => {
    const d = answers[row.id]
    const result = gradeCard(row, { answers: d?.answers ?? {}, journal: d?.journal })
    return {
      id: row.id, part: row.part, sub: row.sub, earned: result.earned, max: result.max, rate: result.rate,
      correct: isAnswered(d) && result.rate >= passRateOf(row), result,
    }
  })
  const bySection: Record<string, number> = {}
  for (const c of cards) bySection[String(c.part)] = (bySection[String(c.part)] ?? 0) + c.earned
  const total = cards.reduce((s, c) => s + c.earned, 0)
  const max = cards.reduce((s, c) => s + c.max, 0)
  return { total, max, passed: total >= KK2_MOCK.passScore, bySection, cards }
}

/** 復習キューに入れる（理解度 C にする）カード。未解答と誤りを入れる。 */
export function missedCards(score: MockScore): MockCardScore[] {
  return score.cards.filter(c => !c.correct)
}

/** 解答済みのカード数（進捗表示）。 */
export function answeredCount(rows: Kk2Row[], answers: MockAnswers): number {
  return rows.filter(r => isAnswered(answers[r.id])).length
}

/** 残り秒数の表示（90:00 形式。1時間以上でも分で出す）。 */
export function formatRemaining(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 画面用の問の呼び名（第1・2問は小問番号つき）。 */
export const cardLabel = (r: { part: number; sub: number }): string => `第${r.part}問${r.part <= 2 ? `(${r.sub})` : ''}`
