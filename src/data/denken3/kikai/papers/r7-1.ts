// 令和7年度 上期 機械（R7上）。r7-2.ts と同じ方針。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-08-04収録: Google Drive「資格/年度別過去問/令和7年上期/機械」の18枚を実読。
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
// 画像18枚（令和7年上期_機械_問1〜18.png）は ImportPanel（年度別モード）から取り込む
// （ファイル名は「問N」を含むため各問の imageFile: a01.png…b18.png へ自動リネームされる）。
// 機械の構成: A問題 問1〜14（各5点=70点）＋ B問題 問15・16（必須, (a)(b) 各5点）
//   ＋ 問17・18（選択, どちらか1問）→ 満点100点（validatePaper が検証する）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R7_1: PaperDefinition = {
  id: 'r7-1',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'kikai',
  name: '令和7年度 上期',
  timeLimitMin: 90,
  questions: [
    { id: 'r7-1_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 10.91, answerYPct: 18.84, explanationEndPct: 85.14, topic: '直流機', parts: [{ correct: 5, points: 5 }] },
    { id: 'r7-1_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 18.40, answerYPct: 24.88, explanationEndPct: 74.19, topic: '直流機', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-1_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 13.41, answerYPct: 19.41, explanationEndPct: 81.68, topic: '誘導機', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-1_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 15.30, answerYPct: 22.18, explanationEndPct: 78.86, topic: '誘導機', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 23.40, answerYPct: 37.24, explanationEndPct: 67.51, topic: '同期機', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 18.99, answerYPct: 24.54, explanationEndPct: 73.78, topic: '同期機', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-1_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 17.10, answerYPct: 29.20, explanationEndPct: 76.37, topic: '電動機応用', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 17.00, answerYPct: 30.63, explanationEndPct: 76.73, topic: '電気機器', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 23.49, answerYPct: 28.47, explanationEndPct: 68.09, topic: '変圧器', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 19.39, answerYPct: 28.90, explanationEndPct: 73.76, topic: 'パワーエレクトロニクス', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-1_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 21.15, answerYPct: 26.49, explanationEndPct: 71.26, topic: '電動機応用', parts: [{ correct: 2, points: 5 }] },
    { id: 'r7-1_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 11.49, answerYPct: 18.37, explanationEndPct: 84.39, topic: '照明', parts: [{ correct: 4, points: 5 }] },
    { id: 'r7-1_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 19.14, answerYPct: 29.48, explanationEndPct: 74.00, topic: '自動制御', parts: [{ correct: 3, points: 5 }] },
    { id: 'r7-1_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 11.49, answerYPct: 22.38, explanationEndPct: 83.99, topic: '情報伝送及び処理', parts: [{ correct: 3, points: 5 }] },

    {
      id: 'r7-1_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 11.23, answerYPct: 20.99, explanationEndPct: 83.85, topic: '誘導機',
      parts: [{ label: '(a)', correct: 4, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
    {
      id: 'r7-1_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 12.29, answerYPct: 24.44, explanationEndPct: 82.58, topic: 'パワーエレクトロニクス',
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
    {
      id: 'r7-1_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 18.92, answerYPct: 27.78, explanationEndPct: 74.50, topic: '電熱', selectable: true,
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
    {
      id: 'r7-1_b18', section: 'B', number: 18, imageFile: 'b18.png', questionStartPct: 13.18, answerYPct: 31.93, explanationEndPct: 82.35, topic: '自動制御', selectable: true,
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 3, points: 5 }],
    },
  ],
}
