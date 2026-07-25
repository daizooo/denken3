// 令和7年度 下期 理論（R7下）。
// 正答・questionStartPct・answerYPct は電験王キャプチャ画像から確認済み（2026-07-25収録、2026-07-25再検出）。
// questionStartPct: 【問題】が始まる縦位置(%)。タイトル・共有ボタン・動画・目次を切り捨てる。
// answerYPct: 【ワンポイント解説】が始まる縦位置(%)。CBT解答中はここから下（解説以降）を隠す。
// 画像18枚はImportPanel（年度別モード）でアップロード済み・denken_question_assetsにも登録済み。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R7_2: PaperDefinition = {
  id: 'r7-2',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'riron',
  name: '令和7年度 下期',
  timeLimitMin: 90,
  questions: [
    { id: 'r7-2_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 15, answerYPct: 35, topic: '電磁気', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-2_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 15, answerYPct: 33, topic: '電磁気', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 17, answerYPct: 29, topic: '電磁気', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 11, answerYPct: 30, topic: '電磁気', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-2_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 9, answerYPct: 23, topic: '電気回路', parts: [{ correct: 1, points: 5 }] },
    { id: 'r7-2_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 14, answerYPct: 33, topic: '電気回路', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-2_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 11, answerYPct: 27, topic: '電気回路', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-2_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 11, answerYPct: 26, topic: '電気回路', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-2_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 12, answerYPct: 34, topic: '電気回路', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-2_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 11, answerYPct: 42, topic: '電気回路', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-2_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 11, answerYPct: 30, topic: '電子理論', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-2_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 14, answerYPct: 30, topic: '電子理論', parts: [{ correct: 1, points: 5 }] },
    { id: 'r7-2_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 15, answerYPct: 33, topic: '電子理論', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 12, answerYPct: 26, topic: '電気及び電子計測', parts: [{ correct: 4, points: 5 }] },

    {
      id: 'r7-2_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 10, answerYPct: 28, topic: '電気回路',
      parts: [{ label: '(a)', correct: 3, points: 5 }, { label: '(b)', correct: 3, points: 5 }],
    },
    {
      id: 'r7-2_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 8, answerYPct: 27, topic: '電気回路',
      parts: [{ label: '(a)', correct: 3, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
    {
      id: 'r7-2_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 6, answerYPct: 29, topic: '電磁気', selectable: true,
      parts: [{ label: '(a)', correct: 5, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
    {
      id: 'r7-2_b18', section: 'B', number: 18, imageFile: 'b18.png', questionStartPct: 5, answerYPct: 29, topic: '電子理論', selectable: true,
      parts: [{ label: '(a)', correct: 5, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
  ],
}
