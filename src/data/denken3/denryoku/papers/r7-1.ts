// 令和7年度 上期 電力（R7上）。電力の r7-2.ts（令和7年度下期）と同じ方針。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-08-04収録: Google Drive「資格/年度別過去問/令和7年上期/電力」の17枚を実読。
//  各画像（幅798px・縦長1枚）を PIL で行単位のインク量に分解し、
//    - questionStartPct: 【難易度】行の直後の空白（＝問題本文の開始。上部の目次・【問題】見出し・
//      難易度行はすべて切り捨てる。難易度直後に本文が始まるため固定レイアウトの ~990px を採用し、
//      本文2行目以降の段落間の空白と混同しないよう、難易度行の次の空白のみを採る）
//    - answerYPct:       【ワンポイント解説】見出しの直前（見出し自体は表示しない。問題本文末尾と
//      見出しの間の空白に置く。選択肢表や図の途中で切らないよう、見出し位置を1問ずつ目視確認した）
//    - explanationEndPct: 末尾「電験3種 過去問徹底解説 令和8年度上期版のご紹介」宣伝バナーの直上
//      （バナーの書籍カバー画像の上端を検出。解説中の図表の下端と取り違えないよう目視確認）
//  を算出した。全17問について「本文冒頭〜answerYPct」「answerYPct境界」「explanationEnd境界」を
//  1問ずつ切り出して目視確認し、末尾の図（問15の図・問16の図4等）を切らないことも確認した。
//  正答は各画像の【解答】欄（A問題は 解答:(N)、B問題は (a)解答:(N)/(b)解答:(N)）を1枚ずつ
//  高解像度で切り出して読み取り、A問題14問・B問題(a)(b)計6箇所を目視で最終確認した。
//  topic は各問題タイトルの《電力》〈分野〉表記による）。
// questionStartPct: 【難易度】行の直後（【問題】見出し・難易度行は表示しない）。
// answerYPct: 【ワンポイント解説】見出しの直前（見出し自体も一切表示しない）。
// explanationEndPct: 解説・解答の本文が終わる位置（宣伝バナー等の定型フッターの直前）。
// CBT解答中は questionStartPct〜answerYPct、結果画面は questionStartPct〜explanationEndPct を表示する。
// 画像17枚（令和7年上期_電力_問1〜17.png）は ImportPanel（年度別モード）から取り込む
// （ファイル名は「問N」を含むため各問の imageFile: a01.png…b17.png へ自動リネームされる）。
// 電力の構成: A問題 問1〜14（各5点=70点）＋ B問題 問15・16・17（必須, (a)(b) 各5点=各10点）
//   → 満点100点（選択問題なし。validatePaper が検証する）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R7_1: PaperDefinition = {
  id: 'r7-1',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'denryoku',
  name: '令和7年度 上期',
  timeLimitMin: 90,
  questions: [
    { id: 'r7-1_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 14.7, answerYPct: 28.61, explanationEndPct: 80.7, topic: '水力', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-1_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 14.8, answerYPct: 18.64, explanationEndPct: 80.7, topic: '火力', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-1_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 14.2, answerYPct: 19.79, explanationEndPct: 81.2, topic: '火力', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-1_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 16.7, answerYPct: 32.06, explanationEndPct: 77.8, topic: '原子力', parts: [{ correct: 1, points: 5 }] },
    { id: 'r7-1_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 19.1, answerYPct: 30.5, explanationEndPct: 75.1, topic: '新エネルギー発電', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-1_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 16.4, answerYPct: 26.35, explanationEndPct: 78.6, topic: '変電', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 22.9, answerYPct: 37.1, explanationEndPct: 70.5, topic: '配電', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 15.0, answerYPct: 24.68, explanationEndPct: 80.5, topic: '送電', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-1_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 14.8, answerYPct: 27.64, explanationEndPct: 80.6, topic: '送電', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 15.5, answerYPct: 27.95, explanationEndPct: 79.9, topic: '送電', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-1_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 19.0, answerYPct: 27.53, explanationEndPct: 75.3, topic: '配電', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 22.1, answerYPct: 28.9, explanationEndPct: 71.5, topic: '送電', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-1_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 21.0, answerYPct: 26.55, explanationEndPct: 72.8, topic: '配電', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-1_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 21.2, answerYPct: 30.1, explanationEndPct: 72.4, topic: '電気材料', parts: [{ correct: 2, points: 5 }] },

    {
      id: 'r7-1_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 19.7, answerYPct: 45.87, explanationEndPct: 74.4, topic: '水力',
      parts: [{ label: '(a)', correct: 5, points: 5 }, { label: '(b)', correct: 5, points: 5 }],
    },
    {
      id: 'r7-1_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 15.7, answerYPct: 26.78, explanationEndPct: 79.5, topic: '配電',
      parts: [{ label: '(a)', correct: 3, points: 5 }, { label: '(b)', correct: 3, points: 5 }],
    },
    {
      id: 'r7-1_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 15.3, answerYPct: 23.95, explanationEndPct: 79.9, topic: '配電',
      parts: [{ label: '(a)', correct: 4, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
  ],
}
