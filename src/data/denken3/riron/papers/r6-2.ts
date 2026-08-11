// 令和6年度 下期 理論（R6下）。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-08-03収録: Google Drive「資格/年度別過去問/令和6年下期/理論」の18枚を実読。
//  各画像を tesseract（日本語）でOCRし、ページ先頭の固定ヘッダ（【問題】見出し・【難易度】行）・
//  【ワンポイント解説】見出し・宣伝バナー（「…令和8年度上期版」のご紹介）のY座標を検出。
//  ヘッダ高は全ページ共通のため questionStartPct は【難易度】行直後（≒画素951/画像高）で確定。
//  正答は各画像の【解答】欄（A問題は解答:(N)、B問題は(a)(b)解答:(N)）を1枚ずつ確認し、
//  B問題（問15〜18）と問1は切り出し画像を目視して確定した。
//  topic は各ページ先頭の電験王カテゴリ《理論》〈…〉に一致させた）。
// questionStartPct: 【難易度】行の直後（【問題】見出し・難易度行は表示しない）。
// answerYPct: 【ワンポイント解説】見出しの直前（見出し自体も一切表示しない）。
// explanationEndPct: 解説・解答の本文が終わる位置（宣伝バナー等の定型フッターの直前）。
// CBT解答中は questionStartPct〜answerYPct、結果画面は questionStartPct〜explanationEndPct を表示する。
// 画像18枚は取り込みパネル（年度別モード）から「…問N.png」のままアップロードすれば
// 問番号で a01.png … b18.png に自動リネームされ、denken_question_assets にも
// answer_y_pct=answerYPct で登録される。収録完了のため draft は付けない
// （validatePaper が満点100点・正答1〜5・重複IDを検証する）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R6_2: PaperDefinition = {
  id: 'r6-2',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'riron',
  name: '令和6年度 下期',
  timeLimitMin: 90,
  questions: [
    { id: 'r6-2_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 17.86, answerYPct: 28.84, explanationEndPct: 76.35, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 1, points: 5 }] },
    { id: 'r6-2_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 20.08, answerYPct: 26.45, explanationEndPct: 73.28, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 1, points: 5 }] },
    { id: 'r6-2_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 21.4, answerYPct: 26.98, explanationEndPct: 71.58, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-2_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 22.21, answerYPct: 36.8, explanationEndPct: 70.59, topic: '電磁気', studyMode: 'memory', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-2_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 15.75, answerYPct: 26.29, explanationEndPct: 78.74, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 5, points: 5 }] },
    { id: 'r6-2_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 10.23, answerYPct: 17.21, explanationEndPct: 86.12, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 4, points: 5 }] },
    { id: 'r6-2_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 21.78, answerYPct: 32.82, explanationEndPct: 70.57, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 4, points: 5 }] },
    { id: 'r6-2_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 19.93, answerYPct: 36.61, explanationEndPct: 72.9, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-2_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 17.46, answerYPct: 23.38, explanationEndPct: 76.44, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-2_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 13.65, answerYPct: 23.98, explanationEndPct: 81.01, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 4, points: 5 }] },
    { id: 'r6-2_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 13.6, answerYPct: 19.8, explanationEndPct: 82.09, topic: '電子理論', studyMode: 'memory', parts: [{ correct: 5, points: 5 }] },
    { id: 'r6-2_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 16.43, answerYPct: 34.36, explanationEndPct: 78.35, topic: '電子理論', studyMode: 'memory', parts: [{ correct: 4, points: 5 }] },
    { id: 'r6-2_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 14.62, answerYPct: 38.45, explanationEndPct: 80.9, topic: '電子理論', studyMode: 'calc', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-2_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 21.46, answerYPct: 30.33, explanationEndPct: 71.47, topic: '電磁気', studyMode: 'memory', parts: [{ correct: 2, points: 5 }] },

    {
      id: 'r6-2_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 8.69, answerYPct: 17.61, explanationEndPct: 87.97, topic: '電気回路', studyMode: 'calc',
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
    {
      id: 'r6-2_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 14.73, answerYPct: 29.26, explanationEndPct: 79.63, topic: '電気及び電子計測', studyMode: 'calc',
      parts: [{ label: '(a)', correct: 3, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
    {
      id: 'r6-2_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 13.93, answerYPct: 29.81, explanationEndPct: 81.33, topic: '電磁気', selectable: true, studyMode: 'calc',
      parts: [{ label: '(a)', correct: 3, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
    {
      id: 'r6-2_b18', section: 'B', number: 18, imageFile: 'b18.png', questionStartPct: 13.26, answerYPct: 36.78, explanationEndPct: 81.57, topic: '電子理論', selectable: true, studyMode: 'calc',
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 1, points: 5 }],
    },
  ],
}
