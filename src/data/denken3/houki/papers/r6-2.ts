// 令和6年度 下期 法規（R6下）。法規の r7-2.ts（令和7年度下期）と同じ方針。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-08-06収録: Google Drive「資格/年度別過去問/令和6年下期/法規」の13枚を実読。
//  各画像（幅798px・縦長1枚）を tesseract 日本語OCRで行ごとにY座標検出し、
//    - questionStartPct: 【問題】直後の【難易度】行を飛ばした先＝問題本文の開始
//                        （難易度行の下端 +12px）
//    - answerYPct:       【ワンポイント解説】見出しの直前（見出し上端 −20px。見出し自体は表示しない）
//    - explanationEndPct: 【解答】本文の末尾＝書籍宣伝バナー（「電験3種 過去問徹底解説
//                         令和8年度上期版」のご紹介）の直前（バナー上端 −18px）
//  を算出した。代表3問（問1=A論説・問3=A穴埋・問11=B計算）は3境界線を重ねて描画した
//  検証画像で目視確認した。正答は各画像の【解答】欄（A問題は 解答:(N)、B問題は
//  (a)解答:(N)/(b)解答:(N)）を1枚ずつ切り出して読み取った。topic は各問題タイトルの〈分野〉表記による）。
// 注意（問1）: 電験王の解答は「(4)及び(5)（試験センターの正答は(5)のみ）」と併記されている
//   （本試験で疑義が出た問題）。採点は試験センターの正答に合わせ correct:5 とする。
// questionStartPct: 【難易度】行の直後（【問題】見出し・難易度行は表示しない）。
// answerYPct: 【ワンポイント解説】見出しの直前（見出し自体も一切表示しない）。
// explanationEndPct: 解説・解答の本文が終わる位置（宣伝バナー等の定型フッターの直前）。
// CBT解答中は questionStartPct〜answerYPct、結果画面は questionStartPct〜explanationEndPct を表示する。
//
// 法規の構成（他科目と異なる）:
//   A問題 問1〜10（各6点=60点）／ B問題 問11〜13（各(a)(b)、選択なし）。
//   配点は 問11=(a)6+(b)7、問12=(a)6+(b)7、問13=(a)7+(b)7 の計40点（→ A60+B40=100点）。
//   制限時間は法規のみ 65分（理論・電力・機械は90分）。
//
// 注意: この定義は正答・配点・切り出し座標のみを収録する。問題/解説画像13枚は
//   ImportPanel（年度別モード）で {user_id}/papers/r6-2/a01.png … b13.png としての
//   アップロードが別途必要（denken_question_assets へ answer_y_pct=answerYPct で登録される）。
//   imageFile 名は問番号に対応（A: a01〜a10 / B: b11〜b13）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R6_2: PaperDefinition = {
  id: 'r6-2',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'houki',
  name: '令和6年度 下期',
  timeLimitMin: 65,
  questions: [
    { id: 'r6-2_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 15.49, answerYPct: 25.16, explanationEndPct: 79.29, topic: '電気事業法', parts: [{ correct: 5, points: 6 }] },
    { id: 'r6-2_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 16.09, answerYPct: 26.76, explanationEndPct: 78.6, topic: '電気工事士法', parts: [{ correct: 3, points: 6 }] },
    { id: 'r6-2_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 23.93, answerYPct: 38.05, explanationEndPct: 68.41, topic: '電気設備技術基準', parts: [{ correct: 3, points: 6 }] },
    { id: 'r6-2_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 18.87, answerYPct: 30.55, explanationEndPct: 74.21, topic: '電気設備技術基準', parts: [{ correct: 4, points: 6 }] },
    { id: 'r6-2_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 19.72, answerYPct: 32.14, explanationEndPct: 73.87, topic: '電気設備技術基準', parts: [{ correct: 5, points: 6 }] },
    { id: 'r6-2_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 18.72, answerYPct: 29.24, explanationEndPct: 75.03, topic: '電気設備技術基準', parts: [{ correct: 4, points: 6 }] },
    { id: 'r6-2_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 15.42, answerYPct: 43.14, explanationEndPct: 78.9, topic: '電気設備技術基準', parts: [{ correct: 3, points: 6 }] },
    { id: 'r6-2_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 17.83, answerYPct: 33.62, explanationEndPct: 76.28, topic: '電気設備技術基準', parts: [{ correct: 4, points: 6 }] },
    { id: 'r6-2_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 21.15, answerYPct: 40.29, explanationEndPct: 71.97, topic: '電気設備技術基準', parts: [{ correct: 3, points: 6 }] },
    { id: 'r6-2_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 17.27, answerYPct: 26.91, explanationEndPct: 78.03, topic: '電気施設管理', parts: [{ correct: 5, points: 6 }] },

    {
      id: 'r6-2_b11', section: 'B', number: 11, imageFile: 'b11.png', questionStartPct: 14.65, answerYPct: 28.4, explanationEndPct: 80.57, topic: '電気施設管理',
      parts: [{ label: '(a)', correct: 3, points: 6 }, { label: '(b)', correct: 1, points: 7 }],
    },
    {
      id: 'r6-2_b12', section: 'B', number: 12, imageFile: 'b12.png', questionStartPct: 13.72, answerYPct: 31.61, explanationEndPct: 81.25, topic: '電気設備技術基準',
      parts: [{ label: '(a)', correct: 4, points: 6 }, { label: '(b)', correct: 1, points: 7 }],
    },
    {
      id: 'r6-2_b13', section: 'B', number: 13, imageFile: 'b13.png', questionStartPct: 17.5, answerYPct: 27.74, explanationEndPct: 76.23, topic: '電気設備技術基準',
      parts: [{ label: '(a)', correct: 4, points: 7 }, { label: '(b)', correct: 3, points: 7 }],
    },
  ],
}
