// 電験3種・理論の年度別ペーパー雛形ジェネレータ（設計 §8 Phase 2a）。
//
// 理論の構成（固定）:
//   A問題 問1〜14（各5点=70点）
//   B問題 問15〜18（各(a)(b) 5点×2=10点／問）。問17・18 は選択（どちらか1問）。
//   → 満点 = A70 + B(必須2問=20点 + 選択1問=10点) = 100点
//
// この関数が返すのは draft=true の「雛形」。実データ収録の手順は §11.2(6):
//   1. 電験王ページを1問1枚でキャプチャ（タイトル・共有ボタン・動画・目次…問題…ワンポイント解説…
//      解答…関連記事、が縦に並ぶ元画像そのまま）
//   2. 各画像の questionStartPct（【問題】が始まる縦位置%）・answerYPct（【ワンポイント解説】が
//      始まる縦位置%）を検出 → 目視確認・補正。CBT表示は questionStartPct 〜 answerYPct の範囲のみを見せる
//   3. 取り込みパネル（年度別モード）で {user_id}/papers/{paperId}/a01.png … としてアップロード
//      （同時に denken_question_assets へ answer_x_pct=100・answer_y_pct=確定値で登録される）
//   4. 各 part の correct を公式正答表と突き合わせて確定・questionStartPct/answerYPct を確定値に更新
//   5. topic / sourceQuestionId（分野別リンク）を任意で追記
//   6. draft を外す（validatePaper が満点100・正答1〜5・重複IDを検証する）

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
      questionStartPct: 0,
      answerYPct: 100,
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
      questionStartPct: 0,
      answerYPct: 100,
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
