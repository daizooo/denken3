// 本番形式模試（licensehub-expansion.md §7・PR-H）の採点と判定。純関数。
//
// 採点は本試験に準拠する: lic_questions.answer_spec の正答で、1問（選択式は1空欄）1点。
//   - 問題誤りの公表による補正（accepted ほか）は answer_spec に反映済みなので、そのまま使う。
//   - law_status（法改正の判定）は採点に使わない。
//   - 正答の無い問・空欄（answer_spec が無い／空欄の正答が無い）は、本試験の「全員正解」と同じく全員に得点を与える。
// 解答は denken_mock_sessions.answers の MockAnswer をそのまま使う。
//   択一式: キーは問ID、selected[0] が選んだ選択肢の番号（1〜5 = A〜E）。0 は未解答。
//   選択式: キーは問ID（1科目＝1問）、selected[i] が空欄 A〜E（i=0〜4）に選んだ語群の通し番号。0 は未解答。
//
// 判定（閾値は src/data/sharoushi/index.ts の SHAROUSHI_THRESHOLDS 由来の ScoringSection から受け取る）:
//   不足:   足切り（科目の floor 未満）が1科目でもある、または総得点が合格基準（passTotal）未満
//   合格圏: 総得点が目標（targetTotal）以上
//   ボーダー: 総得点が合格基準以上で目標未満
//   足切りは本試験の原則で判定し、救済（補正）は見込まない。
import type { AnswerSpec, LicFormat } from '../../domain/license'
import { ITEM_LABELS } from '../../domain/license'
import type { MockAnswer } from '../../domain/types'
import { judgeSection, type ScoringSection, type SectionJudgement, type SubjectScores } from '../../domain/scoring'
import { diffDays } from '../date'
import { FIXTURE_YEARS } from './ingest/schema.ts'

export interface TextMockQuestion {
  id: string
  format: LicFormat
  scored_subject: string
  answer_spec: AnswerSpec | null
}

export type TextVerdict = 'safe' | 'border' | 'short'

export const VERDICT_LABELS: Record<TextVerdict, string> = { safe: '合格圏', border: 'ボーダー', short: '不足' }

export interface QuestionScore { id: string; scoredSubject: string; points: number; maxPoints: number }

export interface TextJudgement {
  judgement: SectionJudgement
  verdict: TextVerdict
  toPass: number      // 合格基準までの不足点（届いていれば 0）
  toTarget: number    // 目標までの不足点（届いていれば 0）
}

export interface TextPaperResult extends TextJudgement {
  subjectScores: SubjectScores
  total: number
  perQuestion: QuestionScore[]
}

/** 択一式の1問で選んだ番号が正答か。 */
export function isTakuCorrect(spec: AnswerSpec, selected: number): boolean {
  if (!(selected >= 1 && selected <= ITEM_LABELS.length)) return false
  if (spec.kind === 'sentaku') return false
  if (spec.kind === 'one') return (spec.accepted ?? [spec.correct]).includes(selected)
  return spec.correct === selected
}

/** 1問（選択式は1科目）の得点と満点。 */
export function scoreQuestion(q: TextMockQuestion, answer: MockAnswer | undefined): QuestionScore {
  const spec = q.answer_spec
  const selected = answer?.selected ?? []
  if (q.format === 'taku') {
    const points = !spec ? 1 : isTakuCorrect(spec, selected[0] ?? 0) ? 1 : 0
    return { id: q.id, scoredSubject: q.scored_subject, points, maxPoints: 1 }
  }
  let points = 0
  ITEM_LABELS.forEach((label, i) => {
    if (!spec) { points++; return }
    if (spec.kind !== 'sentaku') return
    const correct = spec.blanks[label]
    if (correct == null || selected[i] === correct) points++
  })
  return { id: q.id, scoredSubject: q.scored_subject, points, maxPoints: ITEM_LABELS.length }
}

/** 科目別の得点から、足切り・2段の判定と、合格基準・目標までの差を出す。 */
export function judgeText(section: ScoringSection, scores: SubjectScores): TextJudgement {
  const judgement = judgeSection(section, scores)
  const verdict: TextVerdict =
    judgement.floorFailures.length > 0 || !judgement.meetsTotal ? 'short'
      : judgement.meetsTarget ? 'safe'
        : 'border'
  return {
    judgement,
    verdict,
    toPass: Math.max(0, section.passTotal - judgement.total),
    toTarget: Math.max(0, section.targetTotal - judgement.total),
  }
}

/** 1回分（択一式または選択式）の採点と判定。section の科目は得点0でも必ず並べる。 */
export function scoreTextPaper(
  section: ScoringSection, questions: readonly TextMockQuestion[], answers: Record<string, MockAnswer>,
): TextPaperResult {
  const perQuestion = questions.map(q => scoreQuestion(q, answers[q.id]))
  const subjectScores: SubjectScores = Object.fromEntries(section.subjects.map(s => [s.code, 0]))
  for (const r of perQuestion) {
    if (r.scoredSubject in subjectScores) subjectScores[r.scoredSubject] += r.points
  }
  const j = judgeText(section, subjectScores)
  return { ...j, subjectScores, total: j.judgement.total, perQuestion }
}

/** 解答済みか（択一は1つ選んだ、選択式は空欄を1つ以上埋めた）。 */
export function isTextAnswered(answer: MockAnswer | undefined): boolean {
  return !!answer && answer.selected.some(n => n > 0)
}

/** 選択式の空欄 label で選べる語群の番号（空欄ごとに語群が分かれる年度はその語群だけ）。 */
export function blankChoices(spec: AnswerSpec | null, label: (typeof ITEM_LABELS)[number]): number[] {
  if (!spec || spec.kind !== 'sentaku') return []
  const group = spec.groups?.[label]
  if (group && group.length > 0) return [...group]
  return Object.keys(spec.wordbank).map(Number).filter(n => Number.isInteger(n)).sort((a, b) => a - b)
}

/** 正答の表示（択一は A〜E、accepted は「C・D」）。 */
export function takuCorrectLabel(spec: AnswerSpec | null): string {
  if (!spec || spec.kind === 'sentaku') return '全員正解'
  const list = spec.kind === 'one' ? (spec.accepted ?? [spec.correct]) : [spec.correct]
  return list.map(n => ITEM_LABELS[n - 1] ?? '?').join('・')
}

// ---------------------------------------------------------------------------
// 最終期限までの進捗（§7・§8）。R6〜R8 はいつでも模試として解け、どれをいつ解くかは決めない。期限だけを持つ。
// 「済み」は年度×式を1回以上採点確定したもの。フィクスチャの年度（R98・R99）は数えない。

export interface MockPaperRef { year: string; format: LicFormat }

export interface MockProgress {
  deadline: string
  daysLeft: number          // 期限まで（当日 0、過ぎたら負）
  overdue: boolean          // 期限を過ぎて未受験が残っている
  done: MockPaperRef[]
  remaining: MockPaperRef[]
}

export function mockProgress(
  papers: readonly MockPaperRef[],
  finished: readonly { paper_id: string; subject_id: string }[],
  deadline: string, today: string,
): MockProgress {
  const doneKeys = new Set(finished.map(s => `${s.paper_id}-${s.subject_id}`))
  const real = papers.filter(p => !FIXTURE_YEARS.includes(p.year))
  const done = real.filter(p => doneKeys.has(`${p.year}-${p.format}`))
  const remaining = real.filter(p => !doneKeys.has(`${p.year}-${p.format}`))
  const daysLeft = diffDays(today, deadline)
  return { deadline, daysLeft, overdue: daysLeft < 0 && remaining.length > 0, done, remaining }
}

/** 1回分の問が揃っているか（択一: 科目×問数＝70問、選択式: 1科目1問＝8問）。揃っていれば年度を問わず模試として解ける。 */
export function isPaperReady(section: ScoringSection, questionCount: number): boolean {
  return questionCount === (section.id === 'taku' ? section.totalMax : section.subjects.length)
}

// ---------------------------------------------------------------------------
// 誤答の復習（§8.1）。採点確定時に、誤答した問の肢を理解度 C で記録し、日々の復習キューに入れる。
//   択一式: 誤答した問の肢すべて（どの肢の理解が欠けていたかは問の正誤からは分からないため、厳しめに全部）
//   選択式: 誤答した空欄だけ（空欄が肢＝カード）
// 正答の無い問・空欄（全員正解）は対象にしない。肢IDは {問ID}_{A〜E}（§4.2）。

export function missedItemIds(
  questions: readonly (TextMockQuestion & { items?: readonly { label: string }[] })[],
  answers: Record<string, MockAnswer>,
): string[] {
  const out: string[] = []
  for (const q of questions) {
    const spec = q.answer_spec
    if (!spec) continue
    const selected = answers[q.id]?.selected ?? []
    if (q.format === 'taku') {
      if (isTakuCorrect(spec, selected[0] ?? 0)) continue
      const labels = q.items && q.items.length > 0 ? q.items.map(i => i.label) : [...ITEM_LABELS]
      out.push(...labels.map(l => `${q.id}_${l}`))
    } else if (spec.kind === 'sentaku') {
      ITEM_LABELS.forEach((label, i) => {
        const correct = spec.blanks[label]
        if (correct != null && selected[i] !== correct) out.push(`${q.id}_${label}`)
      })
    }
  }
  return out
}

/** 結果画面の得点に添える注記（§8）。 */
export const MOCK_SCORE_NOTE = '出る順で既習の肢を含む得点です。初見の実力の予測には公開模試の得点を使ってください。'
