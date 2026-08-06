// 令和7年度 下期 理論（R7下）。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-07-25収録・再検出・2026-07-25 4回目: ピクセル行のインク密度を走査し、
//  【難易度】直後〜文章開始の空白／最終選択肢〜【ワンポイント解説】直前の空白を
//  それぞれ検出。整数%では空白が1%未満になる問題があったため小数%で確定。
//  2026-07-25 5回目: 全18問を実際に questionStartPct〜answerYPct の範囲で切り出し、
//  1枚ずつ「上端=難易度直後から始まっているか」「下端=解説見出しの直前で終わっているか」
//  を目視確認。b16 は難易度行が残っていたため questionStartPct を補正した。
//  2026-07-25 6回目: 結果画面（解説表示）の末尾に宣伝バナー・共有ボタン・おすすめ記事が
//  含まれる不具合を受け、explanationEndPct（解説の実質的な内容が終わる位置）を追加。
//  全18問についてワンポイント解説・解答の本文終了位置を1問ずつ目視で特定した）。
// questionStartPct: 【難易度】行の直後（【問題】見出し・難易度行は表示しない）。
// answerYPct: 【ワンポイント解説】見出しの直前（見出し自体も一切表示しない）。
// explanationEndPct: 解説・解答の本文が終わる位置（宣伝バナー等の定型フッターの直前）。
// CBT解答中は questionStartPct〜answerYPct、結果画面は questionStartPct〜explanationEndPct を表示する。
// 画像18枚はImportPanel（年度別モード）でアップロード済み・denken_question_assetsにも登録済み。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R7_2: PaperDefinition = {
  id: 'r7-2',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'riron',
  name: '令和7年度 下期',
  timeLimitMin: 90,
  questions: [
    { id: 'r7-2_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 19.92, answerYPct: 32.63, explanationEndPct: 71.64, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-2_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 19.74, answerYPct: 30.25, explanationEndPct: 71.81, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 21.53, answerYPct: 25.89, explanationEndPct: 69.5, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 15.56, answerYPct: 27.22, explanationEndPct: 77.79, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-2_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 12.87, answerYPct: 20.2, explanationEndPct: 82.35, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 1, points: 5 }] },
    { id: 'r7-2_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 19.74, answerYPct: 29.96, explanationEndPct: 72.51, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-2_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 15.18, answerYPct: 25.74, explanationEndPct: 79.02, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-2_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 15.1, answerYPct: 23.77, explanationEndPct: 79.75, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-2_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 16.6, answerYPct: 31.69, explanationEndPct: 76.89, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-2_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 14.8, answerYPct: 40.13, explanationEndPct: 78.9, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-2_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 15.68, answerYPct: 27.73, explanationEndPct: 78.34, topic: '電子理論', studyMode: 'memory', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-2_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 18.43, answerYPct: 27.88, explanationEndPct: 73.92, topic: '電子理論', studyMode: 'calc', parts: [{ correct: 1, points: 5 }] },
    { id: 'r7-2_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 20.22, answerYPct: 30.72, explanationEndPct: 71.61, topic: '電子理論', studyMode: 'memory', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 15.99, answerYPct: 23.67, explanationEndPct: 78.71, topic: '電気及び電子計測', studyMode: 'calc', parts: [{ correct: 4, points: 5 }] },

    {
      id: 'r7-2_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 13.17, answerYPct: 25.45, explanationEndPct: 81.37, topic: '電気回路', studyMode: 'calc',
      parts: [{ label: '(a)', correct: 3, points: 5 }, { label: '(b)', correct: 3, points: 5 }],
    },
    {
      id: 'r7-2_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 12.56, answerYPct: 24.17, explanationEndPct: 82.13, topic: '電気回路', studyMode: 'calc',
      parts: [{ label: '(a)', correct: 3, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
    {
      id: 'r7-2_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 10.23, answerYPct: 26.05, explanationEndPct: 85.85, topic: '電磁気', selectable: true, studyMode: 'calc',
      parts: [{ label: '(a)', correct: 5, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
    {
      id: 'r7-2_b18', section: 'B', number: 18, imageFile: 'b18.png', questionStartPct: 9.06, answerYPct: 26.31, explanationEndPct: 87.69, topic: '電子理論', selectable: true, studyMode: 'memory',
      parts: [{ label: '(a)', correct: 5, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
  ],
}
