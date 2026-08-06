// 令和7年度 上期 理論（R7上）。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-08-03収録: Google Drive「資格/年度別過去問/令和7年上期/理論」の18枚を実読。
//  OCR（tesseract日本語）で各見出しのY座標を検出し、【難易度】直後〜問題文開始、
//  最終選択肢〜【ワンポイント解説】直前、解説本文終了〜宣伝バナー直前を特定。
//  正答は各画像の【解答】欄（A問題は解答:(N)、B問題は(a)(b)解答:(N)）を1枚ずつ目視確認した）。
// questionStartPct: 【難易度】行の直後（【問題】見出し・難易度行は表示しない）。
// answerYPct: 【ワンポイント解説】見出しの直前（見出し自体も一切表示しない）。
// explanationEndPct: 解説・解答の本文が終わる位置（宣伝バナー等の定型フッターの直前）。
// CBT解答中は questionStartPct〜answerYPct、結果画面は questionStartPct〜explanationEndPct を表示する。
// 画像18枚はImportPanel（年度別モード）でアップロード済み・denken_question_assetsにも
// answer_y_pct=answerYPct で登録済み（2026-08-03）。収録完了のため draft は付けない
// （validatePaper が満点100点・正答1〜5・重複IDを検証する）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R7_1: PaperDefinition = {
  id: 'r7-1',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'riron',
  name: '令和7年度 上期',
  timeLimitMin: 90,
  questions: [
    { id: 'r7-1_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 17.29, answerYPct: 23.09, explanationEndPct: 77.02, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-1_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 13.45, answerYPct: 19.46, explanationEndPct: 81.87, topic: '電磁気', studyMode: 'memory', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-1_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 14.21, answerYPct: 23.37, explanationEndPct: 80.8, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 16.31, answerYPct: 27.64, explanationEndPct: 78.05, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-1_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 21.34, answerYPct: 32.63, explanationEndPct: 70.74, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-1_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 14.56, answerYPct: 27.75, explanationEndPct: 79.28, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-1_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 19.19, answerYPct: 27.56, explanationEndPct: 73.54, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 1, points: 5 }] },
    { id: 'r7-1_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 16.95, answerYPct: 20.93, explanationEndPct: 76.54, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-1_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 15.72, answerYPct: 25.53, explanationEndPct: 77.71, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 12.52, answerYPct: 28.09, explanationEndPct: 82.36, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 17.34, answerYPct: 34.1, explanationEndPct: 75.8, topic: '電子理論', studyMode: 'memory', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-1_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 14.97, answerYPct: 29.95, explanationEndPct: 78.95, topic: '電子理論', studyMode: 'memory', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-1_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 15.02, answerYPct: 31.41, explanationEndPct: 78.87, topic: '電子理論', studyMode: 'calc', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-1_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 20.79, answerYPct: 28.04, explanationEndPct: 72.18, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 4, points: 5 }] },

    {
      id: 'r7-1_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 11.76, answerYPct: 21.73, explanationEndPct: 83.37, topic: '電気回路', studyMode: 'calc',
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
    {
      id: 'r7-1_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 9.98, answerYPct: 22.0, explanationEndPct: 85.7, topic: '電気及び電子計測', studyMode: 'calc',
      parts: [{ label: '(a)', correct: 1, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
    {
      id: 'r7-1_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 13.96, answerYPct: 26.49, explanationEndPct: 80.3, topic: '電磁気', selectable: true, studyMode: 'calc',
      parts: [{ label: '(a)', correct: 3, points: 5 }, { label: '(b)', correct: 5, points: 5 }],
    },
    {
      id: 'r7-1_b18', section: 'B', number: 18, imageFile: 'b18.png', questionStartPct: 13.98, answerYPct: 32.41, explanationEndPct: 80.17, topic: '電子理論', selectable: true, studyMode: 'calc',
      parts: [{ label: '(a)', correct: 3, points: 5 }, { label: '(b)', correct: 1, points: 5 }],
    },
  ],
}
