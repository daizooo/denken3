// 令和7年度 下期 機械（R7下）。理論の r7-1.ts / r7-2.ts と同じ方針。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-08-04収録: Google Drive「資格/年度別過去問/令和7年下期/機械」の18枚を実読。
//  各画像の3本の見出しバー（【問題】【ワンポイント解説】【解答】の青い左罫）をピクセル走査で
//  検出し、
//    - questionStartPct: 【問題】バー直後の【難易度】行を飛ばした先＝問題本文の開始
//    - answerYPct:       【ワンポイント解説】バー直前の空白（見出し自体は表示しない）
//    - explanationEndPct: 【解答】以降の本文が終わる位置（末尾の書籍バナー＝関連記事の直前）
//  を算出した。フッターは左側の書籍カバー画像（多色の密なブロック）で判定し、解説中の図表
//  （単色の線画）と区別している。全18問について「本文冒頭〜answerYPct」「【解答】〜末尾」を
//  1問ずつ切り出して目視確認し、正答は各画像の【解答】欄（A問題は 解答:(N)、B問題は
//  (a)解答:(N)/(b)解答:(N)）を1枚ずつ読み取った。topic は各問題タイトルの〈分野〉表記による）。
// questionStartPct: 【難易度】行の直後（【問題】見出し・難易度行は表示しない）。
// answerYPct: 【ワンポイント解説】見出しの直前（見出し自体も一切表示しない）。
// explanationEndPct: 解説・解答の本文が終わる位置（宣伝バナー等の定型フッターの直前）。
// CBT解答中は questionStartPct〜answerYPct、結果画面は questionStartPct〜explanationEndPct を表示する。
// 画像18枚（令和7年下期_機械_問1〜18.png）は ImportPanel（年度別モード）から取り込む
// （ファイル名は「問N」を含むため各問の imageFile: a01.png…b18.png へ自動リネームされる）。
// 機械の構成: A問題 問1〜14（各5点=70点）＋ B問題 問15・16（必須, (a)(b) 各5点）
//   ＋ 問17・18（選択, どちらか1問）→ 満点100点（validatePaper が検証する）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R7_2: PaperDefinition = {
  id: 'r7-2',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'kikai',
  name: '令和7年度 下期',
  timeLimitMin: 90,
  questions: [
    { id: 'r7-2_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 11.48, answerYPct: 34.01, explanationEndPct: 76.62, topic: '直流機', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-2_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 13.03, answerYPct: 19.44, explanationEndPct: 72.77, topic: '直流機', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-2_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 7.47, answerYPct: 17.84, explanationEndPct: 84.66, topic: '誘導機', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-2_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 13.86, answerYPct: 18.57, explanationEndPct: 71.27, topic: '誘導機', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-2_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 12.34, answerYPct: 27.35, explanationEndPct: 72.27, topic: '同期機', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 8.91, answerYPct: 11.96, explanationEndPct: 81.35, topic: '同期機', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-2_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 9.59, answerYPct: 21.13, explanationEndPct: 80.33, topic: '電動機応用', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 11.10, answerYPct: 29.05, explanationEndPct: 75.06, topic: '電気機器', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-2_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 12.16, answerYPct: 18.87, explanationEndPct: 75.04, topic: '変圧器', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 8.93, answerYPct: 19.02, explanationEndPct: 81.64, topic: 'パワーエレクトロニクス', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 11.40, answerYPct: 23.60, explanationEndPct: 76.78, topic: '電動機応用', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-2_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 13.35, answerYPct: 19.09, explanationEndPct: 72.57, topic: '電熱', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-2_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 9.87, answerYPct: 18.23, explanationEndPct: 77.98, topic: '自動制御', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-2_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 10.74, answerYPct: 28.54, explanationEndPct: 77.43, topic: '情報伝送及び処理', parts: [{ correct: 3, points: 5 }] },

    {
      id: 'r7-2_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 11.28, answerYPct: 21.93, explanationEndPct: 74.64, topic: '変圧器',
      parts: [{ label: '(a)', correct: 5, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
    {
      id: 'r7-2_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 13.22, answerYPct: 39.52, explanationEndPct: 71.59, topic: 'パワーエレクトロニクス',
      parts: [{ label: '(a)', correct: 5, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
    {
      id: 'r7-2_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 7.44, answerYPct: 14.10, explanationEndPct: 83.29, topic: '照明', selectable: true,
      parts: [{ label: '(a)', correct: 4, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
    {
      id: 'r7-2_b18', section: 'B', number: 18, imageFile: 'b18.png', questionStartPct: 6.44, answerYPct: 23.46, explanationEndPct: 85.53, topic: '自動制御', selectable: true,
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
  ],
}
