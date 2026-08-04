// 令和6年度 上期 機械（R6上）。r7-2.ts / r7-1.ts と同じ方針。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-08-04収録: Google Drive「資格/年度別過去問/令和6年上期/機械」の18枚を実読。
//  各画像の3本の見出しバー（【問題】【ワンポイント解説】【解答】の青い左罫）をピクセル走査で
//  検出し、
//    - questionStartPct: 【問題】バー直後の【難易度】行を飛ばした先＝問題本文の開始
//    - answerYPct:       【ワンポイント解説】バー直前の空白（見出し自体は表示しない）
//    - explanationEndPct: 【解答】以降の本文が終わる位置（末尾の書籍バナー＝関連記事の直前）
//  を算出した。フッターは左側の書籍カバー画像（密なブロック）で判定し、解説中の図表と区別
//  している。全18問について「本文冒頭〜answerYPct」「【解答】〜末尾」を1問ずつ切り出して目視
//  確認し、正答は各画像の【解答】欄（A問題は 解答:(N)、B問題は (a)解答:(N)/(b)解答:(N)）を
//  1枚ずつ読み取った。topic は各問題タイトルの〈分野〉表記による）。
// questionStartPct: 【難易度】行の直後（【問題】見出し・難易度行は表示しない）。
// answerYPct: 【ワンポイント解説】見出しの直前（見出し自体も一切表示しない）。
// explanationEndPct: 解説・解答の本文が終わる位置（宣伝バナー等の定型フッターの直前）。
// CBT解答中は questionStartPct〜answerYPct、結果画面は questionStartPct〜explanationEndPct を表示する。
// 画像18枚（令和6年上期_機械_問1〜18.png）は ImportPanel（年度別モード）から取り込む
// （ファイル名は「問N」を含むため各問の imageFile: a01.png…b18.png へ自動リネームされる）。
// 機械の構成: A問題 問1〜14（各5点=70点）＋ B問題 問15・16（必須, (a)(b) 各5点）
//   ＋ 問17・18（選択, どちらか1問）→ 満点100点（validatePaper が検証する）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R6_1: PaperDefinition = {
  id: 'r6-1',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'kikai',
  name: '令和6年度 上期',
  timeLimitMin: 90,
  questions: [
    { id: 'r6-1_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 16.56, answerYPct: 29.31, explanationEndPct: 77.54, topic: '直流機', parts: [{ correct: 5, points: 5 }] },
    { id: 'r6-1_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 18.78, answerYPct: 25.24, explanationEndPct: 74.83, topic: '直流機', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-1_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 11.51, answerYPct: 19.92, explanationEndPct: 84.56, topic: '誘導機', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-1_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 22.84, answerYPct: 29.82, explanationEndPct: 69.43, topic: '誘導機', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-1_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 19.27, answerYPct: 32.59, explanationEndPct: 74.31, topic: '同期機', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-1_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 21.22, answerYPct: 26.47, explanationEndPct: 71.36, topic: '同期機', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-1_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 15.56, answerYPct: 26.91, explanationEndPct: 78.05, topic: '四機混合問題', parts: [{ correct: 5, points: 5 }] },
    { id: 'r6-1_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 17.59, answerYPct: 38.58, explanationEndPct: 76.14, topic: '変圧器', parts: [{ correct: 4, points: 5 }] },
    { id: 'r6-1_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 17.64, answerYPct: 23.02, explanationEndPct: 76.07, topic: '変圧器', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-1_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 14.40, answerYPct: 39.81, explanationEndPct: 81.32, topic: 'パワーエレクトロニクス', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-1_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 20.64, answerYPct: 25.73, explanationEndPct: 72.21, topic: '電動機応用', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-1_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 17.31, answerYPct: 32.15, explanationEndPct: 76.51, topic: '電熱', parts: [{ correct: 1, points: 5 }] },
    { id: 'r6-1_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 19.03, answerYPct: 34.79, explanationEndPct: 74.35, topic: '自動制御', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-1_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 10.86, answerYPct: 16.44, explanationEndPct: 85.27, topic: '情報伝送及び処理', parts: [{ correct: 5, points: 5 }] },

    {
      id: 'r6-1_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 12.50, answerYPct: 20.03, explanationEndPct: 83.02, topic: '誘導機',
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 3, points: 5 }],
    },
    {
      id: 'r6-1_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 10.91, answerYPct: 28.38, explanationEndPct: 84.48, topic: 'パワーエレクトロニクス',
      parts: [{ label: '(a)', correct: 5, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
    {
      id: 'r6-1_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 12.12, answerYPct: 19.75, explanationEndPct: 83.55, topic: '照明', selectable: true,
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 1, points: 5 }],
    },
    {
      id: 'r6-1_b18', section: 'B', number: 18, imageFile: 'b18.png', questionStartPct: 10.66, answerYPct: 29.63, explanationEndPct: 85.46, topic: '情報伝送及び処理', selectable: true,
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 4, points: 5 }],
    },
  ],
}
