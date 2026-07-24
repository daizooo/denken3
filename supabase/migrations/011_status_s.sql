-- 理解度 S（完璧に理解した・復習不要）を新設。
-- S にした問題は復習キューから外す（due_date を null にする）が、
-- いつでも復習に戻せる（due_date を再設定するだけ）。
-- status カラムの CHECK 制約に 'S' を追加する。既存の値はそのまま許容する。

ALTER TABLE denken_reviews
  DROP CONSTRAINT IF EXISTS denken_reviews_status_check;

ALTER TABLE denken_reviews
  ADD CONSTRAINT denken_reviews_status_check
  CHECK (status IN ('S', 'A', 'A-', 'B', 'C', 'D', '未着手'));
