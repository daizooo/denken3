// 令和7年度 下期 電力（R7下）。理論の r7-1.ts / r7-2.ts と同じ方針。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-08-04収録: Google Drive「資格/年度別過去問/令和7年下期/電力」の17枚を実読。
//  各画像を tesseract 日本語OCRで行単位に分解し、
//    - questionStartPct: 【難易度】行の直後（問題本文の開始。目次の同名項目は難易度行より上に
//      あるため、難易度行より後ろから探して除外）
//    - answerYPct:       【ワンポイント解説】見出しの直前（見出し自体は表示しない）
//    - explanationEndPct: 末尾の「電験3種過去問徹底解説…のご紹介」宣伝バナーの直上
//      （バナー見出し行をOCRで検出。文字化けした問13のみ青いマスコット画像ブロックの上端で代替）
//  を算出した。全17問について「本文冒頭〜answerYPct」「answerYPct境界」「explanationEnd境界」を
//  1問ずつ切り出して目視確認し、末尾の図（問17の図9等）を切らないことも確認した。
//  正答は各画像の【解答】欄（A問題は 解答:(N)、B問題は (a)解答:(N)/(b)解答:(N)）を1枚ずつ
//  読み取り、17問分の解答欄を並べたモンタージュ画像で最終目視確認した。
//  topic は各問題タイトルの《電力》〈分野〉表記による）。
// questionStartPct: 【難易度】行の直後（【問題】見出し・難易度行は表示しない）。
// answerYPct: 【ワンポイント解説】見出しの直前（見出し自体も一切表示しない）。
// explanationEndPct: 解説・解答の本文が終わる位置（宣伝バナー等の定型フッターの直前）。
// CBT解答中は questionStartPct〜answerYPct、結果画面は questionStartPct〜explanationEndPct を表示する。
// 画像17枚（令和7年下期_電力_問1〜17.png）は ImportPanel（年度別モード）から取り込む
// （ファイル名は「問N」を含むため各問の imageFile: a01.png…b17.png へ自動リネームされる）。
// 電力の構成: A問題 問1〜14（各5点=70点）＋ B問題 問15・16・17（必須, (a)(b) 各5点=各10点）
//   → 満点100点（選択問題なし。validatePaper が検証する）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R7_2: PaperDefinition = {
  id: 'r7-2',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'denryoku',
  name: '令和7年度 下期',
  timeLimitMin: 90,
  questions: [
    { id: 'r7-2_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 13.7, answerYPct: 26.71, explanationEndPct: 81.66, topic: '水力', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 21.91, answerYPct: 28.18, explanationEndPct: 71.06, topic: '水力', parts: [{ correct: 1, points: 5 }] },
    { id: 'r7-2_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 18.03, answerYPct: 32.15, explanationEndPct: 75.88, topic: '火力', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-2_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 13.49, answerYPct: 21.18, explanationEndPct: 82.11, topic: '原子力', parts: [{ correct: 1, points: 5 }] },
    { id: 'r7-2_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 18.44, answerYPct: 26.0, explanationEndPct: 75.57, topic: '新エネルギー発電', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-2_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 17.86, answerYPct: 29.51, explanationEndPct: 76.17, topic: '変電', parts: [{ correct: 1, points: 5 }] },
    { id: 'r7-2_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 13.64, answerYPct: 23.58, explanationEndPct: 81.86, topic: '配電', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 8.95, answerYPct: 15.53, explanationEndPct: 87.89, topic: '送電', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-2_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 11.12, answerYPct: 18.39, explanationEndPct: 85.09, topic: '送電', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 16.52, answerYPct: 26.67, explanationEndPct: 78.12, topic: '送電', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-2_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 20.55, answerYPct: 31.48, explanationEndPct: 72.91, topic: '送電', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-2_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 16.39, answerYPct: 21.88, explanationEndPct: 78.49, topic: '配電', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 14.49, answerYPct: 18.82, explanationEndPct: 85.17, topic: '配電', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 15.48, answerYPct: 23.7, explanationEndPct: 79.4, topic: '電気材料', parts: [{ correct: 3, points: 5 }] },

    {
      id: 'r7-2_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 11.25, answerYPct: 18.73, explanationEndPct: 85.07, topic: '火力',
      parts: [{ label: '(a)', correct: 4, points: 5 }, { label: '(b)', correct: 3, points: 5 }],
    },
    {
      id: 'r7-2_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 13.56, answerYPct: 21.28, explanationEndPct: 81.9, topic: '配電',
      parts: [{ label: '(a)', correct: 4, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
    {
      id: 'r7-2_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 10.8, answerYPct: 19.28, explanationEndPct: 85.51, topic: '配電',
      parts: [{ label: '(a)', correct: 3, points: 5 }, { label: '(b)', correct: 1, points: 5 }],
    },
  ],
}
