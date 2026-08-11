// 令和7年度 下期 法規（R7下）。法規の年度別（CBT模試）ペーパー第1弾。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-08-05収録: Google Drive「資格/年度別過去問/令和7年下期/法規」の13枚を実読。
//  tesseract日本語OCRで各行のY座標を検出し、【難易度】直後〜問題文開始（questionStartPct）、
//  最終選択肢〜【ワンポイント解説】直前（answerYPct）、解説本文終了〜宣伝バナー直前
//  （explanationEndPct）を特定。代表3問（問3=A論説・問7=A穴埋・問11=B計算）は境界線を
//  重ねてクロップ表示し目視確認した。正答は各画像の【解答】欄を1枚ずつ確認している）。
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
//   ImportPanel（年度別モード）で {user_id}/papers/r7-2/a01.png … b13.png としての
//   アップロードが別途必要（denken_question_assets へ answer_y_pct=answerYPct で登録される）。
//   imageFile 名は問番号に対応（A: a01〜a10 / B: b11〜b13）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R7_2: PaperDefinition = {
  id: 'r7-2',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'houki',
  name: '令和7年度 下期',
  timeLimitMin: 65,
  questions: [
    { id: 'r7-2_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 14.67, answerYPct: 33.02, explanationEndPct: 69.26, topic: '電気事業法', parts: [{ correct: 5, points: 6 }] },
    { id: 'r7-2_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 14.83, answerYPct: 29.26, explanationEndPct: 69.0, topic: '電気関係報告規則', parts: [{ correct: 3, points: 6 }] },
    { id: 'r7-2_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 16.5, answerYPct: 35.53, explanationEndPct: 65.54, topic: '電気設備技術基準', parts: [{ correct: 4, points: 6 }] },
    { id: 'r7-2_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 9.66, answerYPct: 19.97, explanationEndPct: 90.06, topic: '電気設備技術基準', parts: [{ correct: 4, points: 6 }] },
    { id: 'r7-2_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 15.64, answerYPct: 31.32, explanationEndPct: 66.73, topic: '電気設備技術基準', parts: [{ correct: 4, points: 6 }] },
    { id: 'r7-2_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 11.74, answerYPct: 27.21, explanationEndPct: 75.14, topic: '電気設備技術基準', parts: [{ correct: 2, points: 6 }] },
    { id: 'r7-2_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 13.15, answerYPct: 40.3, explanationEndPct: 72.63, topic: '電気設備技術基準', parts: [{ correct: 5, points: 6 }] },
    { id: 'r7-2_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 12.36, answerYPct: 29.77, explanationEndPct: 73.94, topic: '電気設備技術基準', parts: [{ correct: 1, points: 6 }] },
    { id: 'r7-2_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 12.48, answerYPct: 37.66, explanationEndPct: 73.5, topic: '電気設備技術基準', parts: [{ correct: 2, points: 6 }] },
    { id: 'r7-2_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 8.45, answerYPct: 24.67, explanationEndPct: 81.73, topic: '電気施設管理', parts: [{ correct: 5, points: 6 }] },

    {
      id: 'r7-2_b11', section: 'B', number: 11, imageFile: 'b11.png', questionStartPct: 9.3, answerYPct: 41.84, explanationEndPct: 79.83, topic: '電気施設管理',
      parts: [{ label: '(a)', correct: 4, points: 6 }, { label: '(b)', correct: 4, points: 7 }],
    },
    {
      id: 'r7-2_b12', section: 'B', number: 12, imageFile: 'b12.png', questionStartPct: 9.13, answerYPct: 23.23, explanationEndPct: 79.95, topic: '電気設備技術基準',
      parts: [{ label: '(a)', correct: 2, points: 6 }, { label: '(b)', correct: 3, points: 7 }],
    },
    {
      id: 'r7-2_b13', section: 'B', number: 13, imageFile: 'b13.png', questionStartPct: 8.71, answerYPct: 25.67, explanationEndPct: 81.28, topic: '電気施設管理',
      parts: [{ label: '(a)', correct: 4, points: 7 }, { label: '(b)', correct: 3, points: 7 }],
    },
  ],
}
