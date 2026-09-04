-- review_history から `prev`（記録直前スナップショット）を取り除くデータ是正。
-- 012 / 013 / 015 と同じ「既存データの誤りを直す」形のマイグレーション。
--
-- ■ prev とは何だったか
-- 履歴エントリを取り消したときに「スケジューラで再計算せず、記録前の状態へ正確に戻す」
-- ための FSRS 状態のコピー。アルゴリズムが変わっても取消結果が揺れないようにする、
-- という意図だった。
--
-- ■ なぜ消すか（実データによる判断・2026-09-04）
-- Phase C（migration 無し・entry.policy.retention）で、履歴の再生そのものが決定的に
-- なった。記録時に適用した目標保持率を各エントリへ書き残すので、何度再生しても同じ
-- 予定日が出る。prev はこの仕組みと役割が完全に重複している。
--
-- 重複しているだけなら無害だが、実データを突き合わせると**両者の答えが食い違っていた**。
--
--   ac1_11  再生 due=2026-08-03  /  prev due=2026-07-30   （stability は 4.372 で一致）
--   ac1_21  再生 due=2026-08-20  /  prev due=2026-08-12   （stability は 8.981 で一致）
--   ac1_25  再生 due=2026-08-25  /  prev due=2026-08-15   （stability は 11.767 で一致）
--
-- stability・理解度は完全に一致し、予定日だけが系統的にズレている。prev は目標保持率が
-- 0.90 だった時期に書かれた値で、その後 0.85 へ変更したときに追随していないためである
-- （間隔は 0.85→0.90 でおよそ半分になる）。
--
-- つまり同じカードの「記録前の状態」が2通りDBに存在し、**末尾のエントリを消すか途中の
-- エントリを消すかで違う予定日が返る**状態だった。残すべきは、記録・取消・再読込の
-- すべての経路が通る再生のほうである。
--
-- ■ 容量
-- review_history 全体 98kB のうち prev が 71kB（72.2%）。読まれない古い値である。
--
-- ■ 可逆性
-- prev を消しても取消は動く（残りの履歴を再生するだけ）。復元が必要になる場面は無い。

UPDATE denken_reviews
SET review_history = (
      SELECT COALESCE(jsonb_agg(e - 'prev' ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(review_history) WITH ORDINALITY AS t(e, ord)
    )
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(review_history) e WHERE e ? 'prev'
);
