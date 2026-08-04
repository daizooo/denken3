// 令和6年度 下期 機械（R6下）。r7-2.ts / r7-1.ts / r6-1.ts と同じ方針。
// 正答・questionStartPct・answerYPct・explanationEndPct は電験王キャプチャ画像から確認済み
// （2026-08-04収録: Google Drive「資格/年度別過去問/令和6年下期/機械」の18枚を実読。
//  各画像の3本の見出しバー（【問題】【ワンポイント解説】【解答】の青い左罫＝色(47,128,198)の
//  2px縦罫）をピクセル走査で検出し、
//    - questionStartPct: 【問題】バー直後の【難易度】行を飛ばした先＝問題本文の開始
//    - answerYPct:       【ワンポイント解説】バー直前の空白（見出し自体は表示しない）
//    - explanationEndPct: 【解答】以降の本文が終わる位置（末尾の書籍バナー＝関連記事の直前）
//  を算出した。フッターは左側の書籍カバー画像（「電験3種」表紙＝密な多色ブロック）で判定し、
//  解説中の図表（単色の線画・時系列波形）と区別している。全18問について「本文冒頭〜answerYPct」
//  「【解答】〜末尾」を1問ずつ切り出して目視確認し、正答は各画像の【解答】欄（A問題は 解答:(N)、
//  B問題は (a)解答:(N)/(b)解答:(N)）を1枚ずつ読み取った。topic は各問題タイトルの〈分野〉表記による）。
// questionStartPct: 【難易度】行の直後（【問題】見出し・難易度行は表示しない）。
// answerYPct: 【ワンポイント解説】見出しの直前（見出し自体も一切表示しない）。
// explanationEndPct: 解説・解答の本文が終わる位置（宣伝バナー等の定型フッターの直前）。
// CBT解答中は questionStartPct〜answerYPct、結果画面は questionStartPct〜explanationEndPct を表示する。
// 画像18枚（令和6年下期_機械_問1〜18.png）は ImportPanel（年度別モード）から取り込む
// （ファイル名は「問N」を含むため各問の imageFile: a01.png…b18.png へ自動リネームされる）。
// 機械の構成: A問題 問1〜14（各5点=70点）＋ B問題 問15・16（必須, (a)(b) 各5点）
//   ＋ 問17・18（選択, どちらか1問）→ 満点100点（validatePaper が検証する）。
import type { ExamId, PaperDefinition } from '../../../../domain/types'

export const R6_2: PaperDefinition = {
  id: 'r6-2',
  examId: 'denken3' satisfies ExamId,
  subjectId: 'kikai',
  name: '令和6年度 下期',
  timeLimitMin: 90,
  questions: [
    { id: 'r6-2_a01', section: 'A', number: 1, imageFile: 'a01.png', questionStartPct: 12.84, answerYPct: 22.84, explanationEndPct: 83.63, topic: '直流機', parts: [{ correct: 5, points: 5 }] },
    { id: 'r6-2_a02', section: 'A', number: 2, imageFile: 'a02.png', questionStartPct: 17.01, answerYPct: 22.33, explanationEndPct: 77.85, topic: '直流機', parts: [{ correct: 1, points: 5 }] },
    { id: 'r6-2_a03', section: 'A', number: 3, imageFile: 'a03.png', questionStartPct: 14.10, answerYPct: 24.37, explanationEndPct: 81.58, topic: '誘導機', parts: [{ correct: 1, points: 5 }] },
    { id: 'r6-2_a04', section: 'A', number: 4, imageFile: 'a04.png', questionStartPct: 15.50, answerYPct: 20.53, explanationEndPct: 79.61, topic: '誘導機', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-2_a05', section: 'A', number: 5, imageFile: 'a05.png', questionStartPct: 20.80, answerYPct: 34.78, explanationEndPct: 73.56, topic: '同期機', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-2_a06', section: 'A', number: 6, imageFile: 'a06.png', questionStartPct: 21.60, answerYPct: 26.34, explanationEndPct: 71.81, topic: '同期機', parts: [{ correct: 1, points: 5 }] },
    { id: 'r6-2_a07', section: 'A', number: 7, imageFile: 'a07.png', questionStartPct: 17.70, answerYPct: 28.23, explanationEndPct: 77.33, topic: '同期機', parts: [{ correct: 4, points: 5 }] },
    { id: 'r6-2_a08', section: 'A', number: 8, imageFile: 'a08.png', questionStartPct: 20.37, answerYPct: 33.82, explanationEndPct: 75.43, topic: '変圧器', parts: [{ correct: 3, points: 5 }] },
    { id: 'r6-2_a09', section: 'A', number: 9, imageFile: 'a09.png', questionStartPct: 12.35, answerYPct: 15.76, explanationEndPct: 84.27, topic: '変圧器', parts: [{ correct: 4, points: 5 }] },
    { id: 'r6-2_a10', section: 'A', number: 10, imageFile: 'a10.png', questionStartPct: 15.77, answerYPct: 32.01, explanationEndPct: 79.95, topic: '電気機器', parts: [{ correct: 1, points: 5 }] },
    { id: 'r6-2_a11', section: 'A', number: 11, imageFile: 'a11.png', questionStartPct: 16.81, answerYPct: 28.28, explanationEndPct: 78.78, topic: '電動機応用', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-2_a12', section: 'A', number: 12, imageFile: 'a12.png', questionStartPct: 21.78, answerYPct: 25.69, explanationEndPct: 72.04, topic: '電熱', parts: [{ correct: 4, points: 5 }] },
    { id: 'r6-2_a13', section: 'A', number: 13, imageFile: 'a13.png', questionStartPct: 22.04, answerYPct: 33.86, explanationEndPct: 71.98, topic: '自動制御', parts: [{ correct: 2, points: 5 }] },
    { id: 'r6-2_a14', section: 'A', number: 14, imageFile: 'a14.png', questionStartPct: 11.83, answerYPct: 22.43, explanationEndPct: 84.44, topic: '情報伝送及び処理', parts: [{ correct: 3, points: 5 }] },

    {
      id: 'r6-2_b15', section: 'B', number: 15, imageFile: 'b15.png', questionStartPct: 14.62, answerYPct: 22.62, explanationEndPct: 80.79, topic: '同期機',
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 3, points: 5 }],
    },
    {
      id: 'r6-2_b16', section: 'B', number: 16, imageFile: 'b16.png', questionStartPct: 14.98, answerYPct: 40.93, explanationEndPct: 80.85, topic: 'パワーエレクトロニクス',
      parts: [{ label: '(a)', correct: 5, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
    {
      id: 'r6-2_b17', section: 'B', number: 17, imageFile: 'b17.png', questionStartPct: 12.17, answerYPct: 23.36, explanationEndPct: 84.41, topic: '照明', selectable: true,
      parts: [{ label: '(a)', correct: 2, points: 5 }, { label: '(b)', correct: 3, points: 5 }],
    },
    {
      id: 'r6-2_b18', section: 'B', number: 18, imageFile: 'b18.png', questionStartPct: 10.78, answerYPct: 31.52, explanationEndPct: 85.96, topic: '情報伝送及び処理', selectable: true,
      parts: [{ label: '(a)', correct: 3, points: 5 }, { label: '(b)', correct: 2, points: 5 }],
    },
  ],
}
