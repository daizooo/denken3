// 令和5年度 上期 理論（R5上）。
// 正答・questionStartPct・answerYPct・explanationEndPct・topic は電験王キャプチャ画像から確認済み
// （2026-08-03収録: Google Drive「資格/年度別過去問/令和5年上期/理論」の18枚を実読。
//  各画像を tesseract（日本語）でOCRし、ページ先頭の固定ヘッダ（【問題】見出し・【難易度】行）・
//  【ワンポイント解説】見出し・宣伝バナー（「…令和8年度上期版」のご紹介）のY座標を検出。
//  さらにピクセル行のインク密度を走査し、各見出し間の空白帯を境界に採った。banner が
//  本文中の「紹介」で誤検出された問4、bannerがOCRできなかった問5は切り出し画像を目視で確定した。
//  正答は各画像の【解答】欄（A問題は解答:(N)、B問題は(a)(b)解答:(N)）を1枚ずつ確認し、
//  Google Drive のOCRテキスト（contentSnippet）とも突き合わせて確定した。
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

export const R5_1: PaperDefinition = {
  id: 'r5-1',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'riron',
  name: '令和5年度 上期',
  timeLimitMin: 90,
  questions: [
    { id: 'r5-1_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 14.61, answerYPct: 37.22, explanationEndPct: 80.46, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 4, points: 5 }] },
    { id: 'r5-1_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 19.04, answerYPct: 28.64, explanationEndPct: 74.8, topic: '電磁気', studyMode: 'memory', parts: [{ correct: 5, points: 5 }] },
    { id: 'r5-1_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 17.62, answerYPct: 26.39, explanationEndPct: 76.66, topic: '電磁気', studyMode: 'memory', parts: [{ correct: 2, points: 5 }] },
    { id: 'r5-1_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 13.14, answerYPct: 20.56, explanationEndPct: 82.41, topic: '電磁気', studyMode: 'memory', parts: [{ correct: 3, points: 5 }] },
    { id: 'r5-1_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 10.75, answerYPct: 14.53, explanationEndPct: 86.3, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 1, points: 5 }] },
    { id: 'r5-1_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 15.88, answerYPct: 22.44, explanationEndPct: 79.56, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 5, points: 5 }] },
    { id: 'r5-1_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 22.52, answerYPct: 37.48, explanationEndPct: 69.99, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r5-1_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 14.92, answerYPct: 26.94, explanationEndPct: 80.79, topic: '電気回路', studyMode: 'memory', parts: [{ correct: 3, points: 5 }] },
    { id: 'r5-1_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 15.96, answerYPct: 23.82, explanationEndPct: 78.66, topic: '電気回路', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },
    { id: 'r5-1_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 19.02, answerYPct: 36.31, explanationEndPct: 74.62, topic: '電磁気', studyMode: 'calc', parts: [{ correct: 4, points: 5 }] },
    { id: 'r5-1_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 16.58, answerYPct: 35.92, explanationEndPct: 77.66, topic: '電子理論', studyMode: 'memory', parts: [{ correct: 5, points: 5 }] },
    { id: 'r5-1_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 21.78, answerYPct: 36.53, explanationEndPct: 71.22, topic: '電気及び電子計測', studyMode: 'memory', parts: [{ correct: 5, points: 5 }] },
    { id: 'r5-1_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 17.4, answerYPct: 29.39, explanationEndPct: 76.23, topic: '電子理論', studyMode: 'memory', parts: [{ correct: 5, points: 5 }] },
    { id: 'r5-1_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 16.26, answerYPct: 27.7, explanationEndPct: 77.93, topic: '電気及び電子計測', studyMode: 'calc', parts: [{ correct: 3, points: 5 }] },

    {
      id: 'r5-1_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 11.56, answerYPct: 20.62, explanationEndPct: 84.39, topic: '電気回路', studyMode: 'calc',
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
    {
      id: 'r5-1_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 15.3, answerYPct: 29.68, explanationEndPct: 79.08, topic: '電気及び電子計測', studyMode: 'calc',
      parts: [{ label: '(a)', correct: 5, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
    {
      id: 'r5-1_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 10.46, answerYPct: 26.23, explanationEndPct: 85.97, topic: '電磁気', selectable: true, studyMode: 'calc',
      parts: [{ label: '(a)', correct: 4, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
    {
      id: 'r5-1_b18', section: 'B', number: 18, imageFile: 'b18.png', questionStartPct: 16.52, answerYPct: 43.52, explanationEndPct: 77.49, topic: '電気及び電子計測', selectable: true, studyMode: 'calc',
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
  ],
}
