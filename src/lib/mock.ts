// 年度別演習（CBT模試）の純ロジック（設計 §7.4）。
// 採点・移行判定・ペーパー検証・Storageパス解決をここに集約する。
// React/Supabase 非依存の純関数のみ。UIとDBアクセスは features/mock-exam 側に置く。

import type {
  MockAnswer, MockSession, PaperDefinition, PaperQuestion,
} from '../domain/types'

// ---- Storageパス規約（§5.3・§7.4(4)）----
// 問題/解説画像は既存の非公開バケット（denken-problems）に
//   {user_id}/papers/{paperId}/{filename}
// で格納する（分野別問題画像と同じ仕組み・署名URL閲覧）。
export function paperImagePath(userId: string, paperId: string, filename: string): string {
  return `${userId}/papers/${paperId}/${filename}`
}

// ---- 選択問題（B問題の択一）----
// 同一paper内の selectable=true の群から実際に解答する1問を決める。
// selected に有効な解答（>0）が入っている selectable 問題を「選択済み」とみなす。
export function isAnswered(ans: MockAnswer | undefined): boolean {
  return !!ans && ans.selected.some(s => s > 0)
}

// 採点対象の問題集合を返す。
// - 非選択問題（selectable でない）はすべて対象。
// - selectable 問題は「解答済みのもの」だけを対象にする（本番の択一を再現）。
//   どれも未解答なら、表示順で最初の selectable を対象にして 0点計上する
//   （＝選択問題を丸ごと落とした扱い。満点=100点の分母を保つ）。
export function scoredQuestions(
  paper: PaperDefinition,
  answers: Record<string, MockAnswer>,
): PaperQuestion[] {
  const fixed = paper.questions.filter(q => !q.selectable)
  const selectables = paper.questions.filter(q => q.selectable)
  const answeredSelectables = selectables.filter(q => isAnswered(answers[q.id]))
  if (answeredSelectables.length > 0) return [...fixed, ...answeredSelectables]
  // 未選択なら先頭の selectable を 0点対象として1問だけ含める
  return selectables.length > 0 ? [...fixed, selectables[0]] : fixed
}

export interface PerQuestionResult {
  question: PaperQuestion
  correct: number[]        // parts の公式正答
  got: number[]            // 自分の解答（未解答は 0）
  ok: boolean[]            // part ごとの正誤
  earned: number          // 得点
  points: number          // 配点
}

export interface ScoreResult {
  total: number                          // 100点換算の得点
  maxTotal: number                       // 満点（通常100）
  sectionScores: { A: number; B: number }
  perQuestion: PerQuestionResult[]
}

// 採点（§7.4(3)）。part 単位で正答と突き合わせ、A/B別に集計する。
export function scorePaper(
  paper: PaperDefinition,
  answers: Record<string, MockAnswer>,
): ScoreResult {
  const targets = scoredQuestions(paper, answers)
  const perQuestion: PerQuestionResult[] = []
  let total = 0, maxTotal = 0
  const sectionScores = { A: 0, B: 0 }

  for (const q of targets) {
    const ans = answers[q.id]
    const correct = q.parts.map(p => p.correct)
    const got = q.parts.map((_, i) => ans?.selected[i] ?? 0)
    const ok = q.parts.map((p, i) => got[i] === p.correct)
    let earned = 0, points = 0
    q.parts.forEach((p, i) => {
      points += p.points
      if (ok[i]) earned += p.points
    })
    total += earned
    maxTotal += points
    sectionScores[q.section] += earned
    perQuestion.push({ question: q, correct, got, ok, earned, points })
  }
  return { total, maxTotal, sectionScores, perQuestion }
}

// ---- 移行判定（§7.4(3)「60点×2回連続」）----
export interface TransitionJudgment {
  met: boolean            // 直近2回のCBTがともに合格点以上
  recentScores: number[]  // 直近から並べた確定スコア（最大5件）
  streak: number          // 直近から連続で合格点以上の回数
  passingScore: number
}

// finished かつ cbt のセッションを finished_at 降順で評価する（設計 §6.3）。
export function transitionJudgment(
  sessions: MockSession[],
  passingScore = 60,
): TransitionJudgment {
  const finished = sessions
    .filter(s => s.status === 'finished' && s.mode === 'cbt' && s.score != null && s.finished_at)
    .sort((a, b) => (b.finished_at! < a.finished_at! ? -1 : 1))
  const recentScores = finished.map(s => s.score as number)
  let streak = 0
  for (const sc of recentScores) {
    if (sc >= passingScore) streak++
    else break
  }
  return {
    met: recentScores.length >= 2 && recentScores[0] >= passingScore && recentScores[1] >= passingScore,
    recentScores: recentScores.slice(0, 5),
    streak,
    passingScore,
  }
}

// ---- ペーパー検証（ビルド時チェック / §9）----
// 正答・配点の転記ミスは採点を直接壊すため、非draftペーパーは必ず検証する。
// draft（収録準備中）は雛形のため対象外。
export function validatePaper(paper: PaperDefinition): string[] {
  const errors: string[] = []
  if (paper.draft) return errors

  const ids = new Set<string>()
  let pointsTotal = 0
  const selectableGroupPoints: number[] = []

  for (const q of paper.questions) {
    if (ids.has(q.id)) errors.push(`重複ID: ${q.id}`)
    ids.add(q.id)
    if (q.parts.length === 0) errors.push(`${q.id}: parts が空`)
    for (const p of q.parts) {
      if (p.correct < 1 || p.correct > 5) errors.push(`${q.id}: correct=${p.correct} は 1〜5 の範囲外`)
      if (p.points <= 0) errors.push(`${q.id}: points=${p.points} が不正`)
    }
    const qPoints = q.parts.reduce((s, p) => s + p.points, 0)
    if (q.selectable) selectableGroupPoints.push(qPoints)
    else pointsTotal += qPoints
  }

  // 選択問題は群から1問だけ解答する前提。満点は「固定分 + 選択1問分」。
  // 群内の配点は同一である前提（1問だけ加算）。
  if (selectableGroupPoints.length > 0) {
    pointsTotal += selectableGroupPoints[0]
    if (selectableGroupPoints.some(p => p !== selectableGroupPoints[0])) {
      errors.push(`選択問題の配点が不揃い: [${selectableGroupPoints.join(', ')}]`)
    }
  }

  if (pointsTotal !== 100) errors.push(`満点が100点ではありません（実際: ${pointsTotal}点）`)
  return errors
}

// ---- 空セッションの雛形（新規受験開始時）----
export function emptyAnswers(): Record<string, MockAnswer> {
  return {}
}
