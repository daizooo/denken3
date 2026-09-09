// 学習中の「切り上げ時間」＝ここまで考えて分からなければ解答を見る、という目安（アラーム）。
// 記録用の計測（timer.ts）とは別物である。timer.ts の上限は「その計測を捨てるか」の判定で、
// こちらは「解くのをやめて解答へ進むか」の判定なので、根拠も値も分けている。
//
// ── なぜ必要か
// この学習者の制約は時間の希少性そのもの（docs/design/study-time-scarcity.md）。
// 解けない1問に15分沈めると、その日の学習がその1問で終わる。過去問学習の定石も
// 「解法が思いつかなければすぐ解答を見て、解き方を覚えて類題に移る」であり、
// 粘る時間を伸ばしても得点は増えない。
//
// ── 何を基準に決めるか
// 「難易度 × studyMode」だけで決める。**個別問題の直近実測と理解度は使わない。**
// 初版は estimateMinutes()（＝時間予算の見積もり）をそのまま基準にしたが、これは誤りだった。
// あちらが答えるのは「今日この問題にどれだけ時間を使うか」で、こちらが要るのは
// 「どこまで粘ってよいか」であり、別の量である。混同すると次の3つが起きる:
//
//   ① 理解度で短くなる（STATUS_FACTOR は A・S に 0.5 を掛ける）。
//      難易度1の計算・理解度A で 120秒 × 0.5 = 60秒 → 切り上げ90秒、と実際に潰れていた。
//      復習は「忘れているかもしれないから解く」のであって、よく分かっている**はず**の
//      問題ほど急かされるのは向きが逆である。
//   ② 個別問題の直近実測（1サンプル）に引きずられる。たまたま速く解けた1回で、
//      以後その問題だけ切り上げが短いまま固定される。
//   ③ ②はラチェットになる。切り上げに従えば記録される解答時間が縮み、縮んだ実測が
//      次の切り上げをさらに縮める。アラームが自分の入力を削る自己参照ループになる。
//
// ── 採用する式
//   切り上げ秒 = min( max(既定表, 実測中央値) × 1.5, 本番の持ち時間 )
//
// - **既定表**（estimateMinutes.baselineSeconds）: 難易度 × studyMode の素の所要秒。
//   2026-09-01 の実測に基づく固定値で、理解度も個別の履歴も混ざらない。
// - **実測中央値**: 「難易度 × studyMode」の中央値（母数不足なら難易度のみ）。自分が
//   その手の問題にどれくらいかかるかを反映する。ただし **伸ばす方向にだけ効かせる**
//   （max を採る）。短すぎる切り上げは解けたはずの問題を中断させて有害だが、長すぎる
//   切り上げはアラームが鳴らないだけで無害 ―― 損失が非対称なので長い側へ倒す。
//   これで ③ のラチェットも構造的に起きない（実測が縮んでも既定表より下がらない）。
// - **倍率 1.5**: 1.0 だと典型どおりに解けている最中でも半数近くで鳴り、雑音になる。
//   2.0 だと難易度2の計算で11分となり、本番の持ち時間を大きく超えて意味を失う。
// - **上限＝本番の持ち時間**（A問題5分・B問題10分・examTime.ts）: 本番で解ききれない
//   時間をかけている以上、学習でそれ以上粘っても本番の得点には結びつかない。
//
// 下限は置いていない。既定表の最小（難易度1の暗記90秒）でも 90 × 1.5 = 135秒 あり、
// 定数の下限を足すと「難易度を無視した一定値」が実質の主役になる（初版の欠陥）。
//
// 純ロジックのみ。DB・UI・音には依存しない。

import type { MasterQuestion } from '../domain/types'
import { baselineSeconds, type TimeStats } from './estimateMinutes'
import { examTimeLimitSeconds } from './examTime'

// 典型的な所要時間に掛ける倍率。詳細は上のコメント。
export const CUTOFF_FACTOR = 1.5

// 「難易度 × studyMode」の典型所要秒。既定表と実測中央値の大きいほう。
export function typicalSeconds(q: MasterQuestion, stats: TimeStats): number {
  const measured =
    stats.byModeBand[q.difficulty]?.[q.studyMode ?? 'unset'] ??
    stats.byBand[q.difficulty]
  return Math.max(baselineSeconds(q), measured ?? 0)
}

// 切り上げ秒。A問題／B問題の判定は出典表記（タイトル末尾）から行う（examTime.ts）。
export function cutoffSeconds(q: MasterQuestion, stats: TimeStats): number {
  const raw = Math.round(typicalSeconds(q, stats) * CUTOFF_FACTOR)
  return Math.min(raw, examTimeLimitSeconds(q.title))
}

// 経過表示は "3:07" 形式（本番CBTの残り時間表示と同じ読み方に揃える）。
// 60分以上は "1:02:03"。学習1問でそこまで行くことはないが、一時停止したまま
// 放置した場合に "62:03" と出るより読み違えにくい。
export function formatClock(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const s = String(sec % 60).padStart(2, '0')
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}:${s}`
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${s}`
}
