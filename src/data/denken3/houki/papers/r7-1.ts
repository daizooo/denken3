// 令和7年度 上期 法規（R7上）。法規の r7-2.ts（令和7年度下期）と同じ方針。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-08-05収録: Google Drive「資格/年度別過去問/令和7年上期/法規」の13枚を実読。
//  各画像（幅798px・縦長1枚）を PIL で解析し、3見出しの青い左罫（【問題】【ワンポイント解説】
//  【解答】の x35〜38・色(44,127,196)）を走査して検出。
//    - questionStartPct: 【問題】直後の【難易度】行を飛ばした先＝問題本文の開始
//    - answerYPct:       【ワンポイント解説】見出しの直前（見出し自体は表示しない）
//    - explanationEndPct: 【解答】本文の末尾＝書籍宣伝バナー（「電験3種 過去問徹底解説」の
//                         カバー画像・高さ約83px）の直前
//  を算出した。全13問について「本文冒頭〜answerYPct」「【解答】〜バナー直前」を1問ずつ
//  切り出して目視確認し、正答は各画像の【解答】欄（A問題は 解答:(N)、B問題は
//  (a)解答:(N)/(b)解答:(N)）を1枚ずつ読み取った。topic は各問題タイトルの〈分野〉表記による）。
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
//   ImportPanel（年度別モード）で {user_id}/papers/r7-1/a01.png … b13.png としての
//   アップロードが別途必要（denken_question_assets へ answer_y_pct=answerYPct で登録される）。
//   imageFile 名は問番号に対応（A: a01〜a10 / B: b11〜b13）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R7_1: PaperDefinition = {
  id: 'r7-1',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'houki',
  name: '令和7年度 上期',
  timeLimitMin: 65,
  questions: [
    { id: 'r7-1_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 15.71, answerYPct: 29.1, explanationEndPct: 79.85, topic: '電気事業法', parts: [{ correct: 5, points: 6 }] },
    { id: 'r7-1_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 18.63, answerYPct: 29.0, explanationEndPct: 76.08, topic: '電気関係報告規則', parts: [{ correct: 4, points: 6 }] },
    { id: 'r7-1_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 25.83, answerYPct: 40.32, explanationEndPct: 66.9, topic: '電気設備技術基準', parts: [{ correct: 1, points: 6 }] },
    { id: 'r7-1_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 21.22, answerYPct: 42.71, explanationEndPct: 73.03, topic: '電気設備技術基準', parts: [{ correct: 3, points: 6 }] },
    { id: 'r7-1_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 24.71, answerYPct: 39.99, explanationEndPct: 68.31, topic: '風力設備技術基準', parts: [{ correct: 4, points: 6 }] },
    { id: 'r7-1_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 21.37, answerYPct: 34.2, explanationEndPct: 72.81, topic: '電気設備技術基準', parts: [{ correct: 2, points: 6 }] },
    { id: 'r7-1_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 18.16, answerYPct: 43.03, explanationEndPct: 76.71, topic: '電気設備技術基準', parts: [{ correct: 5, points: 6 }] },
    { id: 'r7-1_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 21.18, answerYPct: 35.14, explanationEndPct: 72.81, topic: '電気設備技術基準', parts: [{ correct: 4, points: 6 }] },
    { id: 'r7-1_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 14.25, answerYPct: 29.99, explanationEndPct: 81.73, topic: '電気設備技術基準', parts: [{ correct: 1, points: 6 }] },
    { id: 'r7-1_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 19.95, answerYPct: 35.44, explanationEndPct: 74.39, topic: '電気施設管理', parts: [{ correct: 5, points: 6 }] },

    {
      id: 'r7-1_b11', section: 'B', number: 11, imageFile: 'b11.png', questionStartPct: 12.54, answerYPct: 23.54, explanationEndPct: 83.92, topic: '電気施設管理',
      parts: [{ label: '(a)', correct: 3, points: 6 }, { label: '(b)', correct: 5, points: 7 }],
    },
    {
      id: 'r7-1_b12', section: 'B', number: 12, imageFile: 'b12.png', questionStartPct: 13.52, answerYPct: 28.57, explanationEndPct: 82.66, topic: '電気施設管理',
      parts: [{ label: '(a)', correct: 2, points: 6 }, { label: '(b)', correct: 2, points: 7 }],
    },
    {
      id: 'r7-1_b13', section: 'B', number: 13, imageFile: 'b13.png', questionStartPct: 15.05, answerYPct: 32.79, explanationEndPct: 80.82, topic: '電気施設管理',
      parts: [{ label: '(a)', correct: 2, points: 7 }, { label: '(b)', correct: 3, points: 7 }],
    },
  ],
}
