-- 時間予算（1日に使える分数）の永続化（adaptive-fsrs-policy.md Phase B-2）
--
-- これまで時間予算は App.tsx の useState だけに存在し、リロードで消えていた（§1.1）。
-- 端末をまたいで同じ予算で計画が引かれるようにDBへ置く。
--
-- 既存の daily_cap（migration 002）はコード上どこからも読まれていないデッドカラムだが、
-- 意味が「問数の上限」で今回の「分/日」とは別物のため、再利用せず新しい列を追加する。
-- 既存列の意味を変える改修は、他PRの同時編集とマージ時に取り違えを生むため避ける。
--
-- NULL = 予算未選択（「すべて」）。行なし = 未設定でも同じ扱い。
ALTER TABLE denken_settings
  ADD COLUMN IF NOT EXISTS time_budget_minutes INTEGER;
