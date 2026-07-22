-- Phase 0: 資格スコープ(exam_id)の導入
-- 既存進捗を壊さずに複数資格（将来: 電験2種・エネ管等）へ拡張できるよう、
-- denken_reviews の主キーに exam_id を追加する。
-- 既存行は DEFAULT 'denken3' で自動バックフィルされ、挙動は変わらない。
-- ロールバックは列削除（PKを元に戻す）で可能。

ALTER TABLE denken_reviews
  ADD COLUMN IF NOT EXISTS exam_id TEXT NOT NULL DEFAULT 'denken3';

ALTER TABLE denken_reviews DROP CONSTRAINT denken_reviews_pkey;
ALTER TABLE denken_reviews ADD PRIMARY KEY (user_id, exam_id, question_id);
