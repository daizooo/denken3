// 電験3種・理論の年度別ペーパー雛形ジェネレータ（設計 §8 Phase 2a）。
//
// 理論の構成（固定）:
//   A問題 問1〜14（各5点=70点）
//   B問題 問15〜18（各(a)(b) 5点×2=10点／問）。問17・18 は選択（どちらか1問）。
//   → 満点 = A70 + B(必須2問=20点 + 選択1問=10点) = 100点
//
// この関数が返すのは draft=true の「雛形」。実データ収録の手順は §7.4(4):
//   1. 電験王から問題/解説画像を切り出し、取り込みパネル（年度別モード）で
//      {user_id}/papers/{paperId}/a01.png・a01_exp.png … としてアップロード
//   2. 各 part の correct を公式正答表と突き合わせて確定
//   3. topic / sourceQuestionId（分野別リンク）を任意で追記
//   4. draft を外す（validatePaper が満点100・正答1〜5・重複IDを検証する）

import type { ExamId, PaperDefinition, PaperQuestion } from '../../../../domain/types'

const pad2 = (n: number) => String(n).padStart(2, '0')

// 正答は収録時に確定する。雛形段階のプレースホルダ（draft=true のため採点には使わない）。
const TODO_CORRECT = 1 as const

export function rironPaperSkeleton(
  paperId: string,
  name: string,
): PaperDefinition {
  const questions: PaperQuestion[] = []

  // A問題 問1〜14（各5点）
  for (let n = 1; n <= 14; n++) {
    questions.push({
      id: `${paperId}_a${pad2(n)}`,
      section: 'A',
      number: n,
      imageFile: `a${pad2(n)}.png`,
      explanationFile: `a${pad2(n)}_exp.png`,
      parts: [{ correct: TODO_CORRECT, points: 5 }],
    })
  }

  // B問題 問15〜18（各(a)(b) 5点）。問17・18 は選択。
  for (let n = 15; n <= 18; n++) {
    questions.push({
      id: `${paperId}_b${n}`,
      section: 'B',
      number: n,
      imageFile: `b${n}.png`,
      explanationFile: `b${n}_exp.png`,
      selectable: n >= 17,
      parts: [
        { label: '(a)', correct: TODO_CORRECT, points: 5 },
        { label: '(b)', correct: TODO_CORRECT, points: 5 },
      ],
    })
  }

  return {
    id: paperId,
    examId: 'denken3' satisfies ExamId,
    subjectId: 'riron',
    name,
    timeLimitMin: 90,
    questions,
    draft: true, // 収録が済んだら false にする
  }
}
