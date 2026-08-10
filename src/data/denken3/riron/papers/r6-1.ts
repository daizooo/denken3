// 令和6年度 上期 理論（R6上）。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-08-03収録: Google Drive「資格/年度別過去問/令和6年上期/理論」の18枚を実読。
//  各画像を tesseract（日本語）でOCRし、【難易度】行・【ワンポイント解説】見出し・
//  【解答】行・宣伝バナー（「…のご紹介」）のY座標を検出。切り出し範囲を1問ずつ目視確認した。
//  正答は各画像の【解答】欄（A問題は解答:(N)、B問題は(a)(b)解答:(N)）を1枚ずつ確認し、
//  問11（誤りを選ぶ設問で解答番号がOCR不能）は解説の (4)誤り から確定、B問題(問15/17/18)は
//  切り出し画像を目視して確定した。topic は各ページ先頭の電験王カテゴリ《理論》〈…〉に一致させた）。
// questionStartPct: 【難易度】行の直後（【問題】見出し・難易度行は表示しない）。
// answerYPct: 【ワンポイント解説】見出しの直前（見出し自体も一切表示しない）。
// explanationEndPct: 解説・解答の本文が終わる位置（宣伝バナー等の定型フッターの直前）。
// CBT解答中は questionStartPct〜answerYPct、結果画面は questionStartPct〜explanationEndPct を表示する。
// 画像18枚は取り込みパネル（年度別モード）から「…問N.png」のままアップロードすれば
// 問番号で a01.png … b18.png に自動リネームされ、denken_question_assets にも
// answer_y_pct=answerYPct で登録される。収録完了のため draft は付けない
// （validatePaper が満点100点・正答1〜5・重複IDを検証する）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R6_1: PaperDefinition = {
  id: 'r6-1',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'riron',
  name: '令和6年度 上期',
  timeLimitMin: 90,
  questions: [
    { id: 'r6-1_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 18.65, answerYPct: 42.26, explanationEndPct: 75.65, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 5, points: 5 }] },
    { id: 'r6-1_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 23.34, answerYPct: 30.56, explanationEndPct: 69.37, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 4, points: 5 }] },
    { id: 'r6-1_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 18.83, answerYPct: 26.08, explanationEndPct: 75.21, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-1_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 20.02, answerYPct: 35.56, explanationEndPct: 73.6, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-1_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 10.46, answerYPct: 14.77, explanationEndPct: 86.84, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 1, points: 5 }] },
    { id: 'r6-1_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 17.68, answerYPct: 26.36, explanationEndPct: 76.42, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 1, points: 5 }] },
    { id: 'r6-1_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 16.38, answerYPct: 22.52, explanationEndPct: 78.34, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-1_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 14.82, answerYPct: 25.27, explanationEndPct: 80.42, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-1_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 20.56, answerYPct: 27.81, explanationEndPct: 72.58, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-1_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 12.45, answerYPct: 28.82, explanationEndPct: 87.41, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-1_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 11.88, answerYPct: 17.86, explanationEndPct: 84.27, topic: '電子理論', studyMode: 'memory', parts: [{ correct: 4, points: 5 }] },
    { id: 'r6-1_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 18.32, answerYPct: 35.05, explanationEndPct: 75.57, topic: '電子理論', studyMode: 'calc', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-1_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 12.17, answerYPct: 21.34, explanationEndPct: 83.9, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-1_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 13.23, answerYPct: 19.89, explanationEndPct: 82.37, topic: '電気及び電子計測', studyMode: 'memory', parts: [{ correct: 3, points: 5 }] },

    {
      id: 'r6-1_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 11.07, answerYPct: 21.4, explanationEndPct: 85.25, topic: '電気回路', studyMode: 'calc',
      parts: [{ label: '(a)', correct: 4, points: 5 }, { label: '(b)', correct: 3, points: 5 }],
    },
    {
      id: 'r6-1_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 15.25, answerYPct: 29.13, explanationEndPct: 79.19, topic: '電気及び電子計測', studyMode: 'calc',
      parts: [{ label: '(a)', correct: 4, points: 5 }, { label: '(b)', correct: 5, points: 5 }],
    },
    {
      id: 'r6-1_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 11.96, answerYPct: 24.54, explanationEndPct: 84.79, topic: '電気回路', selectable: true, studyMode: 'calc',
      parts: [{ label: '(a)', correct: 5, points: 5 }, { label: '(b)', correct: 3, points: 5 }],
    },
    {
      id: 'r6-1_b18', section: 'B', number: 18, imageFile: 'b18.png', questionStartPct: 10.54, answerYPct: 37.49, explanationEndPct: 86.0, topic: '電子理論', selectable: true, studyMode: 'memory',
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 5, points: 5 }],
    },
  ],
}
