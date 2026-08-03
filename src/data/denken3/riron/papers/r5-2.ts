// 令和5年度 下期 理論（R5下）。
// 正答・questionStartPct・answerYPct・explanationEndPct・topic は電験王キャプチャ画像から確認済み
// （2026-08-03収録: Google Drive「資格/年度別過去問/令和5年下期/理論」の18枚を実読。
//  各画像を tesseract（日本語）でOCRし、ページ先頭の固定ヘッダ（【問題】見出し・【難易度】行）・
//  【ワンポイント解説】見出し・宣伝バナー（「…令和8年度上期版」のご紹介）のY座標を検出。
//  さらにピクセル行のインク密度を走査し、各見出し間の空白帯の中央を境界に採った。
//  正答は各画像の【解答】欄（A問題は解答:(N)、B問題は(a)(b)解答:(N)）を1枚ずつ確認し、
//  B問題（問15〜18）と一部A問題は切り出し画像を目視して確定した。
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

export const R5_2: PaperDefinition = {
  id: 'r5-2',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'riron',
  name: '令和5年度 下期',
  timeLimitMin: 90,
  questions: [
    { id: 'r5-2_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 15.79, answerYPct: 27.89, explanationEndPct: 79.32, topic: '電磁気', parts: [{ correct: 1, points: 5 }] },
    { id: 'r5-2_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 13.41, answerYPct: 36.48, explanationEndPct: 82.11, topic: '電磁気', parts: [{ correct: 1, points: 5 }] },
    { id: 'r5-2_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 23.07, answerYPct: 36.17, explanationEndPct: 68.74, topic: '電磁気', parts: [{ correct: 4, points: 5 }] },
    { id: 'r5-2_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 13.49, answerYPct: 27.32, explanationEndPct: 81.85, topic: '電磁気', parts: [{ correct: 2, points: 5 }] },
    { id: 'r5-2_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 16.62, answerYPct: 24.23, explanationEndPct: 78.37, topic: '電気回路', parts: [{ correct: 5, points: 5 }] },
    { id: 'r5-2_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 22.62, answerYPct: 32.29, explanationEndPct: 69.39, topic: '電気回路', parts: [{ correct: 4, points: 5 }] },
    { id: 'r5-2_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 15.8, answerYPct: 26.13, explanationEndPct: 78.75, topic: '電気回路', parts: [{ correct: 5, points: 5 }] },
    { id: 'r5-2_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 16.21, answerYPct: 23.51, explanationEndPct: 77.95, topic: '電気回路', parts: [{ correct: 2, points: 5 }] },
    { id: 'r5-2_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 21.05, answerYPct: 27.21, explanationEndPct: 71.73, topic: '電気回路', parts: [{ correct: 2, points: 5 }] },
    { id: 'r5-2_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 14.89, answerYPct: 28.47, explanationEndPct: 79.66, topic: '電気回路', parts: [{ correct: 5, points: 5 }] },
    { id: 'r5-2_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 14.33, answerYPct: 23.5, explanationEndPct: 80.83, topic: '電子理論', parts: [{ correct: 1, points: 5 }] },
    { id: 'r5-2_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 14.44, answerYPct: 30.87, explanationEndPct: 80.21, topic: '電子理論', parts: [{ correct: 5, points: 5 }] },
    { id: 'r5-2_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 18.09, answerYPct: 24.74, explanationEndPct: 75.63, topic: '電子理論', parts: [{ correct: 3, points: 5 }] },
    { id: 'r5-2_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 21.66, answerYPct: 29.55, explanationEndPct: 70.09, topic: '電磁気', parts: [{ correct: 5, points: 5 }] },

    {
      id: 'r5-2_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 8.45, answerYPct: 19.05, explanationEndPct: 88.54, topic: '電気回路',
      parts: [{ label: '(a)', correct: 3, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
    {
      id: 'r5-2_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 20.33, answerYPct: 38.31, explanationEndPct: 71.84, topic: '電気及び電子計測',
      parts: [{ label: '(a)', correct: 4, points: 5 }, { label: '(b)', correct: 5, points: 5 }],
    },
    {
      id: 'r5-2_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 12.01, answerYPct: 24.06, explanationEndPct: 84.32, topic: '電気回路', selectable: true,
      parts: [{ label: '(a)', correct: 5, points: 5 }, { label: '(b)', correct: 3, points: 5 }],
    },
    {
      id: 'r5-2_b18', section: 'B', number: 18, imageFile: 'b18.png', questionStartPct: 15.88, answerYPct: 45.42, explanationEndPct: 78.45, topic: '電子理論', selectable: true,
      parts: [{ label: '(a)', correct: 4, points: 5 }, { label: '(b)', correct: 1, points: 5 }],
    },
  ],
}
